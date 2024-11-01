create extension if not exists "pg_net" with schema "public" version '0.10.0';

alter table "public"."payment" drop constraint "payment_property_id_fkey";

alter table "public"."payment" drop column "property_id";


