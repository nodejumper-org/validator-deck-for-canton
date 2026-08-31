CREATE TABLE "node_access" (
	"node_id" text NOT NULL,
	"user_id" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "node_access_node_id_user_id_pk" PRIMARY KEY("node_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "node_access" ADD CONSTRAINT "node_access_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_access" ADD CONSTRAINT "node_access_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "node_access_user_id_idx" ON "node_access" USING btree ("user_id");