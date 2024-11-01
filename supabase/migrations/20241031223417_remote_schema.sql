create extension if not exists "pg_net" with schema "public" version '0.10.0';

alter table "public"."property_filing" drop constraint "property_filing_payment_id_fkey";

alter table "public"."payment" add column "property_filing_id" bigint not null;

alter table "public"."profiles" add column "deleted" timestamp with time zone;

alter table "public"."property_filing" drop column "payment_id";

alter table "public"."property_filing" add column "deleted" timestamp with time zone;

alter table "public"."user_roles" enable row level security;

alter table "public"."userproperty_filing" add column "deleted" timestamp with time zone;

alter table "public"."payment" add constraint "payment_property_filing_id_fkey" FOREIGN KEY (property_filing_id) REFERENCES property_filing(id) not valid;

alter table "public"."payment" validate constraint "payment_property_filing_id_fkey";


