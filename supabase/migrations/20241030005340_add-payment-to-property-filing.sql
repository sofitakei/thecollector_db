alter table "public"."property_filing" add column "payment_id" bigint;

alter table "public"."property_filing" add constraint "property_filing_payment_id_fkey" FOREIGN KEY (payment_id) REFERENCES payment(id) not valid;

alter table "public"."property_filing" validate constraint "property_filing_payment_id_fkey";