using Microsoft.EntityFrameworkCore;

namespace FinSight.Api.Data;

public sealed class FinSightDbContext : DbContext
{
    public FinSightDbContext(DbContextOptions<FinSightDbContext> options) : base(options)
    {
    }

    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<WatchlistItem> WatchlistItems => Set<WatchlistItem>();
    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Username).IsRequired().HasMaxLength(100);
            entity.Property(x => x.PasswordHash).IsRequired();
            entity.HasIndex(x => x.Username).IsUnique();
        });

        modelBuilder.Entity<Account>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Name).IsRequired().HasMaxLength(200);
            entity.Property(x => x.Currency).IsRequired().HasMaxLength(3);
            entity.HasIndex(x => x.Name);
        });

        modelBuilder.Entity<Transaction>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Category).IsRequired().HasMaxLength(200);
            entity.Property(x => x.Note).HasMaxLength(2000);
            entity.HasIndex(x => x.AccountId);
            entity.HasOne(x => x.Account)
                .WithMany()
                .HasForeignKey(x => x.AccountId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<WatchlistItem>(entity =>
        {
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Symbol).IsRequired().HasMaxLength(20);
            entity.HasIndex(x => x.Symbol).IsUnique();
        });
    }
}

public sealed class Account
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Currency { get; set; } = "EUR";
    public DateTime CreatedAtUtc { get; set; }
}

public sealed class Transaction
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public Account? Account { get; set; }

    public DateOnly Date { get; set; }
    public decimal Amount { get; set; }
    public string Category { get; set; } = "Uncategorized";
    public string? Note { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public sealed class WatchlistItem
{
    public Guid Id { get; set; }
    public string Symbol { get; set; } = string.Empty;
    public DateTime AddedAtUtc { get; set; }
}

public sealed class User
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
}
