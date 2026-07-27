CREATE TYPE "public"."network" AS ENUM('devnet', 'testnet', 'mainnet', 'local');--> statement-breakpoint
CREATE TABLE "nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"network" "network" DEFAULT 'devnet' NOT NULL,
	"ledger_api_url" text NOT NULL,
	"validator_api_url" text,
	"auth_token_url" text NOT NULL,
	"auth_client_id" text NOT NULL,
	"auth_client_secret_enc" text NOT NULL,
	"auth_audience" text,
	"auth_scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
