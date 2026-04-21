using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using BCrypt.Net;
using FinSight.Api.Data;
using FinSight.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<FinSightDbContext>(options =>
{
    options.UseSqlite(builder.Configuration.GetConnectionString("FinSight") ?? "Data Source=finsight.db");
});

var corsPolicyName = "ReactDev";
builder.Services.AddCors(options =>
{
    options.AddPolicy(corsPolicyName, policy =>
    {
        policy
            .WithOrigins("http://localhost:5173", "http://localhost:3000")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddOpenApi();

var jwtKey = builder.Configuration["Jwt:Key"] ?? "FinSight-Super-Secret-Dev-Key-2025-AtLeast32Chars!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "FinSight.Api";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "FinSight.Web";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddHttpClient<FinnhubService>();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<FinSight.Api.Data.FinSightDbContext>();
    db.Database.EnsureCreated();
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseCors(corsPolicyName);

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }))
    .WithName("Health");

app.MapPost("/api/auth/register", async (AuthRequest request, FinSight.Api.Data.FinSightDbContext db) =>
{
    var username = (request.Username ?? string.Empty).Trim();
    if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(request.Password))
        return Results.BadRequest(new { error = "Username and password are required." });

    if (username.Length < 3)
        return Results.BadRequest(new { error = "Username must be at least 3 characters." });

    if (request.Password.Length < 6)
        return Results.BadRequest(new { error = "Password must be at least 6 characters." });

    var exists = await db.Users.AnyAsync(u => u.Username == username);
    if (exists)
        return Results.Conflict(new { error = "Username already taken." });

    var user = new FinSight.Api.Data.User
    {
        Id = Guid.NewGuid(),
        Username = username,
        PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
        CreatedAtUtc = DateTime.UtcNow
    };

    db.Users.Add(user);
    await db.SaveChangesAsync();

    return Results.Ok(new { message = "Registration successful." });
})
    .WithName("Register");

app.MapPost("/api/auth/login", async (AuthRequest request, FinSight.Api.Data.FinSightDbContext db) =>
{
    var username = (request.Username ?? string.Empty).Trim();
    if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(request.Password))
        return Results.BadRequest(new { error = "Username and password are required." });

    var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username);
    if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        return Results.Unauthorized();

    var claims = new[]
    {
        new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
        new Claim(JwtRegisteredClaimNames.UniqueName, user.Username),
        new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
    };

    var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
    var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
    var expiryHours = builder.Configuration.GetValue<int>("Jwt:ExpiryHours", 12);

    var token = new JwtSecurityToken(
        issuer: jwtIssuer,
        audience: jwtAudience,
        claims: claims,
        expires: DateTime.UtcNow.AddHours(expiryHours),
        signingCredentials: creds);

    var tokenString = new JwtSecurityTokenHandler().WriteToken(token);

    return Results.Ok(new { token = tokenString, username = user.Username });
})
    .WithName("Login");

app.MapGet("/api/accounts", async (FinSight.Api.Data.FinSightDbContext db) =>
{
    var accounts = await db.Accounts
        .OrderBy(a => a.CreatedAtUtc)
        .ToListAsync();

    return Results.Ok(accounts);
})
    .WithName("GetAccounts")
    .RequireAuthorization();

app.MapPost("/api/accounts", async (CreateAccountRequest request, FinSight.Api.Data.FinSightDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(request.Name))
    {
        return Results.BadRequest(new { error = "Name is required." });
    }

    var account = new FinSight.Api.Data.Account
    {
        Id = Guid.NewGuid(),
        Name = request.Name.Trim(),
        Currency = string.IsNullOrWhiteSpace(request.Currency) ? "EUR" : request.Currency.Trim().ToUpperInvariant(),
        CreatedAtUtc = DateTime.UtcNow
    };

    db.Accounts.Add(account);
    await db.SaveChangesAsync();
    return Results.Created($"/api/accounts/{account.Id}", account);
})
    .WithName("CreateAccount")
    .RequireAuthorization();

app.MapGet("/api/transactions", async (Guid? accountId, FinSight.Api.Data.FinSightDbContext db) =>
{
    var query = db.Transactions.AsQueryable();
    if (accountId is not null)
    {
        query = query.Where(t => t.AccountId == accountId.Value);
    }

    var items = await query
        .OrderByDescending(t => t.Date)
        .ThenByDescending(t => t.CreatedAtUtc)
        .ToListAsync();

    return Results.Ok(items);
})
    .WithName("GetTransactions")
    .RequireAuthorization();

app.MapPost("/api/transactions", async (CreateTransactionRequest request, FinSight.Api.Data.FinSightDbContext db) =>
{
    if (request.AccountId == Guid.Empty)
    {
        return Results.BadRequest(new { error = "AccountId is required." });
    }

    var accountExists = await db.Accounts.AnyAsync(a => a.Id == request.AccountId);
    if (!accountExists)
    {
        return Results.NotFound(new { error = "Account not found." });
    }

    if (request.Amount == 0)
    {
        return Results.BadRequest(new { error = "Amount must be non-zero." });
    }

    var tx = new FinSight.Api.Data.Transaction
    {
        Id = Guid.NewGuid(),
        AccountId = request.AccountId,
        Date = request.Date ?? DateOnly.FromDateTime(DateTime.UtcNow),
        Amount = request.Amount,
        Category = string.IsNullOrWhiteSpace(request.Category) ? "Uncategorized" : request.Category.Trim(),
        Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
        CreatedAtUtc = DateTime.UtcNow
    };

    db.Transactions.Add(tx);
    await db.SaveChangesAsync();
    return Results.Created($"/api/transactions/{tx.Id}", tx);
})
    .WithName("CreateTransaction")
    .RequireAuthorization();

app.MapDelete("/api/transactions/{id}", async (Guid id, FinSight.Api.Data.FinSightDbContext db) =>
{
    var tx = await db.Transactions.FindAsync(id);
    if (tx is null)
        return Results.NotFound(new { error = "Transaction not found." });

    db.Transactions.Remove(tx);
    await db.SaveChangesAsync();
    return Results.NoContent();
})
    .WithName("DeleteTransaction")
    .RequireAuthorization();

app.MapGet("/api/stocks/watchlist", async (FinSight.Api.Data.FinSightDbContext db) =>
{
    var items = await db.WatchlistItems
        .OrderByDescending(w => w.AddedAtUtc)
        .ToListAsync();

    return Results.Ok(items);
})
    .WithName("GetWatchlist")
    .RequireAuthorization();

app.MapPost("/api/stocks/watchlist", async (AddWatchlistItemRequest request, FinSight.Api.Data.FinSightDbContext db) =>
{
    var symbol = (request.Symbol ?? string.Empty).Trim().ToUpperInvariant();
    if (string.IsNullOrWhiteSpace(symbol))
    {
        return Results.BadRequest(new { error = "Symbol is required." });
    }

    var exists = await db.WatchlistItems.AnyAsync(w => w.Symbol == symbol);
    if (exists)
    {
        return Results.Conflict(new { error = "Symbol already in watchlist." });
    }

    var item = new FinSight.Api.Data.WatchlistItem
    {
        Id = Guid.NewGuid(),
        Symbol = symbol,
        AddedAtUtc = DateTime.UtcNow
    };

    db.WatchlistItems.Add(item);
    await db.SaveChangesAsync();
    return Results.Created($"/api/stocks/watchlist/{item.Id}", item);
})
    .WithName("AddWatchlistItem")
    .RequireAuthorization();

app.MapDelete("/api/stocks/watchlist/{id}", async (Guid id, FinSight.Api.Data.FinSightDbContext db) =>
{
    var item = await db.WatchlistItems.FindAsync(id);
    if (item is null)
        return Results.NotFound(new { error = "Watchlist item not found." });

    db.WatchlistItems.Remove(item);
    await db.SaveChangesAsync();
    return Results.NoContent();
})
    .WithName("DeleteWatchlistItem")
    .RequireAuthorization();

static StockQuote CreateMockQuote(string symbol)
{
    var seed = Math.Abs(symbol.GetHashCode());
    var price = Math.Round(10m + (seed % 20000) / 100m, 2);
    var changePct = Math.Round((((seed % 2000) - 1000) / 10000m) * 100m, 2);
    return new StockQuote(
        Symbol: symbol,
        Price: price,
        ChangePercent: changePct,
        AsOfUtc: DateTimeOffset.UtcNow);
}

app.MapGet("/api/stocks/quote/{symbol}", async (string symbol, FinnhubService finnhub, ILoggerFactory loggerFactory, CancellationToken ct) =>
{
    symbol = (symbol ?? string.Empty).Trim().ToUpperInvariant();
    if (string.IsNullOrWhiteSpace(symbol))
    {
        return Results.BadRequest(new { error = "Symbol is required." });
    }

    try
    {
        var (price, changePercent) = await finnhub.GetStockPrice(symbol, ct);
        var quote = new StockQuote(
            Symbol: symbol,
            Price: price,
            ChangePercent: changePercent,
            AsOfUtc: DateTimeOffset.UtcNow);

        return Results.Ok(quote);
    }
    catch (Exception ex)
    {
        var logger = loggerFactory.CreateLogger("Finnhub");
        logger.LogWarning(ex, "Finnhub quote lookup failed for {Symbol}. Falling back to mock quote.", symbol);
        return Results.Ok(CreateMockQuote(symbol));
    }
})
    .WithName("GetStockQuote")
    .RequireAuthorization();

app.Run();
record StockQuote(string Symbol, decimal Price, decimal ChangePercent, DateTimeOffset AsOfUtc);

record CreateAccountRequest(string Name, string? Currency);
record CreateTransactionRequest(Guid AccountId, DateOnly? Date, decimal Amount, string? Category, string? Note);
record AddWatchlistItemRequest(string? Symbol);
record AuthRequest(string? Username, string? Password);
