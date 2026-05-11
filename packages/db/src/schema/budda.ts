import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  googleDriveToken: jsonb("google_drive_token"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon").default("🧘"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("products_user_id_idx").on(table.userId)],
);

export const entries = pgTable(
  "entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    content: text("content"),
    context: text("context"),

    entryType: text("entry_type").notNull().default("Other"),
    source: text("source").notNull().default("Manual"),

    link: text("link"),
    filePath: text("file_path"),
    fileName: text("file_name"),
    fileType: text("file_type"),

    contentHash: text("content_hash"),
    previousContentHash: text("previous_content_hash"),
    hasChanges: boolean("has_changes").default(false).notNull(),

    embedding: vector("embedding", { dimensions: 768 }),

    status: text("status").default("Active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("entries_product_id_idx").on(table.productId),
    index("entries_user_id_idx").on(table.userId),
    index("entries_entry_type_idx").on(table.entryType),
    index("entries_source_idx").on(table.source),
    index("entries_embedding_idx")
      .using("ivfflat", table.embedding.op("vector_cosine_ops"))
      .with({ lists: 100 }),
  ],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    referencedEntryIds: uuid("referenced_entry_ids")
      .array()
      .default(sql`'{}'::uuid[]`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("chat_messages_product_id_idx").on(table.productId),
    index("chat_messages_user_id_idx").on(table.userId),
  ],
);

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(user, {
    fields: [profiles.userId],
    references: [user.id],
  }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  user: one(user, {
    fields: [products.userId],
    references: [user.id],
  }),
  entries: many(entries),
  chatMessages: many(chatMessages),
}));

export const entriesRelations = relations(entries, ({ one }) => ({
  product: one(products, {
    fields: [entries.productId],
    references: [products.id],
  }),
  user: one(user, {
    fields: [entries.userId],
    references: [user.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  product: one(products, {
    fields: [chatMessages.productId],
    references: [products.id],
  }),
  user: one(user, {
    fields: [chatMessages.userId],
    references: [user.id],
  }),
}));
