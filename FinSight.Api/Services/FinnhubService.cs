using System.Net.Http.Json;

namespace FinSight.Api.Services;

public sealed class FinnhubService
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;

    public FinnhubService(HttpClient http, IConfiguration config)
    {
        _http = http;
        _config = config;
    }

    public async Task<(decimal Price, decimal ChangePercent)> GetStockPrice(string symbol, CancellationToken cancellationToken = default)
    {
        symbol = (symbol ?? string.Empty).Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(symbol))
        {
            throw new ArgumentException("Symbol is required.", nameof(symbol));
        }

        var token = _config["Finnhub:Token"];
        if (string.IsNullOrWhiteSpace(token))
        {
            token = "d54rlp1r01qojbih2jfgd54rlp1r01qojbih2jg0";
        }

        var url = $"https://finnhub.io/api/v1/quote?symbol={Uri.EscapeDataString(symbol)}&token={Uri.EscapeDataString(token)}";
        var dto = await _http.GetFromJsonAsync<FinnhubQuoteDto>(url, cancellationToken);
        if (dto is null)
        {
            throw new InvalidOperationException("Finnhub returned an empty response.");
        }

        var price = Convert.ToDecimal(dto.c);
        var changePercent = Convert.ToDecimal(dto.dp);

        if (price <= 0)
        {
            throw new InvalidOperationException("Finnhub returned an invalid price.");
        }

        return (price, changePercent);
    }

    private sealed record FinnhubQuoteDto(double c, double dp);
}
