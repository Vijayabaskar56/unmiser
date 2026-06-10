import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const exchangeRates = sqliteTable(
  "exchange_rates",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    fromCurrency: text().notNull(),
    toCurrency: text().notNull(),
    rate: text().notNull(), // BigDecimal as string
    provider: text().notNull(),
    updatedAt: text().notNull(), // ISO; epoch is derivable, not stored
    expiresAt: text().notNull(),
  },
  (t) => [
    uniqueIndex("index_exchange_rates_from_currency_to_currency").on(t.fromCurrency, t.toCurrency),
    index("index_exchange_rates_from_currency").on(t.fromCurrency),
    index("index_exchange_rates_to_currency").on(t.toCurrency),
    index("index_exchange_rates_updated_at").on(t.updatedAt),
    index("index_exchange_rates_expires_at").on(t.expiresAt),
  ],
);

export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type NewExchangeRate = typeof exchangeRates.$inferInsert;
