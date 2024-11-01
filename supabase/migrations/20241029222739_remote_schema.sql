

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgsodium" WITH SCHEMA "pgsodium";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_permission" AS ENUM (
    'channels.delete',
    'messages.delete'
);


ALTER TYPE "public"."app_permission" OWNER TO "postgres";


CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'moderator'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."propertyRelation" AS ENUM (
    'owner',
    'board_member',
    'unassigned'
);


ALTER TYPE "public"."propertyRelation" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "first_name" "text",
    "last_name" "text",
    "email" "text",
    "updated_at" "date",
    "id" bigint NOT NULL,
    "auth_user_id" "uuid",
    "suffix" "text",
    "fincen_id" "text",
    "middle_name" "text",
    "birth_date" "date",
    "address" "text",
    "city" "text",
    "state_id" bigint,
    "postal_code" "text",
    "document_type" "text",
    "document_number" "text",
    "document_country_jurisdiction_id" bigint,
    "document_jurisdiction_local_tribal_id" bigint,
    "document_jurisdiction_other_description" "text",
    "effective_date" "text",
    "country_jurisdiction_id" integer,
    "identification_url" "text",
    "document_expiration" "date",
    "stripe_customer_id" "text",
    "document_state_id" bigint,
    "notifications_on" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_member_to_property"("property_id" integer, "first_name" "text", "last_name" "text" DEFAULT NULL::"text", "email" "text" DEFAULT NULL::"text", "property_role" "text" DEFAULT NULL::"text", "is_manager" boolean DEFAULT false) RETURNS SETOF "public"."profiles"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    new_profile_id int;
BEGIN
    INSERT INTO profiles (
      first_name,last_name,email
    )
        VALUES ( first_name,last_name,email)
    RETURNING
        id INTO new_profile_id;
        INSERT into userproperty (user_id, property_id, property_role, is_manager) VALUES (new_profile_id, property_id, property_role, is_manager);

    RETURN query
    SELECT
        *
    FROM
        profiles
    WHERE
        profiles.id = new_profile_id;
END;
$$;


ALTER FUNCTION "public"."add_member_to_property"("property_id" integer, "first_name" "text", "last_name" "text", "email" "text", "property_role" "text", "is_manager" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_members_to_property"("members" "jsonb") RETURNS SETOF "public"."profiles"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    new_profile_id int;
BEGIN
WITH ins AS (select *
from json_to_recordset(members)
as cols(first_name text, last_name text, email text))

insert into profiles  (first_name,last_name,email)
select first_name, last_name, email from ins
returning id as id_from_insert;


END;
$$;


ALTER FUNCTION "public"."add_members_to_property"("members" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."properties" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text",
    "address1" "text",
    "tax_id_type" "text",
    "tax_id_number" "text",
    "country_jurisdiction_id" bigint,
    "address2" "text",
    "zipcode" "text",
    "city" "text",
    "created_by" bigint,
    "filing_current" boolean,
    "deleted" timestamp with time zone,
    "state_id" bigint
);


ALTER TABLE "public"."properties" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_property_with_owner"("name" "text", "address1" "text" DEFAULT NULL::"text", "address2" "text" DEFAULT NULL::"text", "city" "text" DEFAULT NULL::"text", "country_jurisdiction_id" integer DEFAULT NULL::integer, "created_by" integer DEFAULT NULL::integer, "state_id" bigint DEFAULT NULL::integer, "tax_id_number" "text" DEFAULT NULL::"text", "tax_id_type" "text" DEFAULT NULL::"text", "zipcode" "text" DEFAULT NULL::"text", "property_role" "text" DEFAULT NULL::"text") RETURNS SETOF "public"."properties"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    new_property_id int;
BEGIN
    INSERT INTO properties (address1,
address2,
city,
country_jurisdiction_id,
created_by,
name,
state_id,
tax_id_number,
tax_id_type,
zipcode)
        VALUES (address1,
address2,
city,
country_jurisdiction_id,
created_by,
name,
state_id,
tax_id_number,
tax_id_type,
zipcode)
    RETURNING
        id INTO new_property_id;
        INSERT into userproperty (user_id, property_id, property_role,is_manager) VALUES (created_by, new_property_id, property_role,true);
perform update_property_filing(new_property_id);
    RETURN query
    SELECT
        *
    FROM
        properties
    WHERE
        properties.id = new_property_id;
END;
$$;


ALTER FUNCTION "public"."add_property_with_owner"("name" "text", "address1" "text", "address2" "text", "city" "text", "country_jurisdiction_id" integer, "created_by" integer, "state_id" bigint, "tax_id_number" "text", "tax_id_type" "text", "zipcode" "text", "property_role" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."userproperty_filing" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "userproperty_id" bigint,
    "filingdata" "jsonb",
    "status" "text",
    "propertyfiling_id" bigint
);


ALTER TABLE "public"."userproperty_filing" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_userproperty_filing"("userproperty_id" integer, "filingdata" "jsonb") RETURNS SETOF "public"."userproperty_filing"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    new_filing_id int;
BEGIN
        UPDATE userproperty_filing  
         set status = 'void'
         where userproperty_id=userproperty_id;
    INSERT INTO userproperty_filing (userproperty_id,
    status,
    filingdata)
        VALUES (userproperty_id, 'verified',filingdata)
    RETURNING
        id INTO new_filing_id;


    RETURN query
    SELECT
        *
    FROM
        userproperty_filing 
    WHERE
        id = new_filing_id;
END;
$$;


ALTER FUNCTION "public"."add_userproperty_filing"("userproperty_id" integer, "filingdata" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."property_filing" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "property_id" bigint,
    "filing" "jsonb",
    "status" "text",
    "submitted" timestamp with time zone,
    "filing_type" "text",
    "last_updated" timestamp with time zone,
    "last_updated_by_user_id" bigint,
    "api_process_id" "text",
    "api_submission_status" "text"
);


ALTER TABLE "public"."property_filing" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_filing_with_payment"("amount" numeric, "created_by_user_id" integer, "method" "text", "service_level" "text", "status" "text", "property_id" integer) RETURNS SETOF "public"."property_filing"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    new_payment_id int;
    new_filing_id int;
BEGIN
    INSERT INTO payment (amount,
created_by_user_id,
method,
service_level,
status,
created_at)
        VALUES (amount,
created_by_user_id,
method,
service_level,
status,
current_timestamp
)
    RETURNING
        id INTO new_payment_id;
        INSERT into property_filing ( property_id, payment_id,created_at) VALUES (property_id,new_payment_id, current_timestamp) returning id into new_filing_id;

    RETURN query
    SELECT
        *
    FROM
        property_filing
    WHERE
        id = new_filing_id;
END;
$$;


ALTER FUNCTION "public"."create_filing_with_payment"("amount" numeric, "created_by_user_id" integer, "method" "text", "service_level" "text", "status" "text", "property_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."custom_access_token_hook"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    AS $$
  declare
    claims jsonb;
    user_role public.app_role;
  begin
    -- Fetch the user role in the user_roles table
    select role into user_role from public.user_roles where user_id = (event->>'user_id')::uuid;

    claims := event->'claims';

    if user_role is not null then
      -- Set the claim
      claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
    else
      claims := jsonb_set(claims, '{user_role}', 'null');
    end if;

    -- Update the 'claims' object in the original event
    event := jsonb_set(event, '{claims}', claims);

    -- Return the modified or original event
    return event;
  end;
$$;


ALTER FUNCTION "public"."custom_access_token_hook"("event" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_editable_users"() RETURNS bigint[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  return 
     (select user_id from userproperty where property_id in (select  public.get_properties_for_user(auth.uid())));
end;
$$;


ALTER FUNCTION "public"."get_editable_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_editable_users"("_user_id" "uuid") RETURNS SETOF bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  return query
     (select user_id from userproperty where property_id in (select  public.get_properties_for_user(_user_id)));
end;
$$;


ALTER FUNCTION "public"."get_editable_users"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_properties_for_user"("user_id" "uuid") RETURNS SETOF bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$

  SELECT property_id from userproperty where user_id = (SELECT id from profiles where auth_user_id = $1 )
$_$;


ALTER FUNCTION "public"."get_properties_for_user"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_properties_with_status_for_user"("_user_id" bigint) RETURNS TABLE("rproperty_id" bigint, "rproperty_name" "text", "ris_manager" boolean, "total_filers" bigint, "verified_filers" bigint)
    LANGUAGE "plpgsql"
    AS $_$

BEGIN
return query
select distinct on(property_id)
	property_id,
	upv."name" ,
	is_manager ,
	count(user_id) as total_property_filers,
	count(user_filing_status = 'verified') as verified_filed_users
from
	user_properties_view upv
where
	property_id in 
(
	select
		property_id
	from
		userproperty u
	where
		user_id = $1)
	and property_role != 'nonreporting'
group by
	property_id, name, is_manager;


END;
$_$;


ALTER FUNCTION "public"."get_properties_with_status_for_user"("_user_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_property_details"("_property_id" bigint) RETURNS TABLE("property_id" bigint, "property_name" "text", "address1" "text", "created_at" timestamp with time zone, "tax_id_type" "text", "tax_id_number" "text", "country_jurisdiction_id" bigint, "country" "text", "zipcode" "text", "city" "text", "state_id" bigint, "state" "text", "filing_status" "text", "filing" "jsonb", "filing_id" bigint)
    LANGUAGE "plpgsql"
    AS $$

begin
return query
select distinct on(p.id)
	p.id as property_id,
	p.name as property_name,
	p.address1,
	p.created_at,
	p.tax_id_type,
	p.tax_id_number,
	p.country_jurisdiction_id,
	c.english_short_name as country,
	p.zipcode,
	p.city,
	p.state_id,
	st.state,
	pf.status as filing_status,
	pf.filing as filing,
	pf.id as filing_id
from
	properties p
left join property_filing pf on
	pf.property_id = p.id
left join countries c on
	c.id = p.country_jurisdiction_id
left join states st on
	st.id = p.state_id
where
	p.id = _property_id
	and p.deleted is null
order by p.id, pf.created_at desc;
end;

$$;


ALTER FUNCTION "public"."get_property_details"("_property_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
    -- record new row to Postgres Logs | Remove when you're done debugging
    RAISE LOG 'logged handle_new_user: %', (select to_jsonb(new.*));

    INSERT INTO public.profiles(auth_user_id, email) 
    VALUES (new.id, new.email)
    ON CONFLICT (email) DO UPDATE
    SET auth_user_id = new.id;
    RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invite_members_to_property"("members" "json", "propertyid" bigint) RETURNS SETOF bigint
    LANGUAGE "plpgsql"
    AS $$
declare PROFILE_IDS BIGINT[];

begin
return QUERY 
with recursive 
INS as (
select
	*
from
	JSON_TO_RECORDSET(MEMBERS)
as COLS(FIRST_NAME text,
	LAST_NAME text,
	EMAIL text,
	PROPERTY_ROLE text,
	IS_MANAGER BOOL)),

profileids as (
insert
	into
		PROFILES (FIRST_NAME,
		LAST_NAME,
		EMAIL)
		select
			FIRST_NAME,
			LAST_NAME,
			EMAIL
		from
			INS
on
			conflict (EMAIL) do
			update
			set
				FIRST_NAME = EXCLUDED.FIRST_NAME,
				last_name = excluded.last_name
returning ID, email)


insert
	into
	userproperty (property_id,
	user_id,
	property_role,
	is_manager)
select
	propertyID,
	pi.id,
	ins.property_role,
	ins.is_manager
from profileids pi left join ins on ins.email=pi.email 

returning id;


end;


$$;


ALTER FUNCTION "public"."invite_members_to_property"("members" "json", "propertyid" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_manager_of"("_user_id" "uuid", "_property_id" bigint) RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
SELECT EXISTS (
  SELECT 1
  from userproperty up 
  left join profiles p
  on up.user_id = p.id
left join user_roles ur on ur.user_id = _user_id
  WHERE (up.property_id = _property_id
  AND p.auth_user_id = _user_id
AND up.is_manager is true)
OR ur.role = 'admin'
) 
$$;


ALTER FUNCTION "public"."is_manager_of"("_user_id" "uuid", "_property_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_manager_of_filing"("_user_id" "uuid", "_property_filing_id" bigint) RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
SELECT EXISTS (
  SELECT 1
  from userproperty up 
  left join profiles p
  on up.user_id = p.id
left join property_filing pf on pf.property_id = up.property_id
left join user_roles ur on ur.user_id = _user_id

  WHERE (pf.id = _property_filing_id
  AND p.auth_user_id = _user_id
AND up.is_manager is true)
OR ur.role = 'admin'
) 
$$;


ALTER FUNCTION "public"."is_manager_of_filing"("_user_id" "uuid", "_property_filing_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_member_of"("_user_id" "uuid", "_property_id" bigint) RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
SELECT EXISTS (
  SELECT 1
  from userproperty up 
  left join profiles p
  on up.user_id = p.id
left join user_roles ur on ur.user_id = _user_id
  WHERE (up.property_id = _property_id
  AND p.auth_user_id = _user_id)
OR ur.role = 'admin'
) 
$$;


ALTER FUNCTION "public"."is_member_of"("_user_id" "uuid", "_property_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_member_of_filing"("_user_id" "uuid", "_property_filing_id" bigint) RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
SELECT EXISTS (
  SELECT 1
  from userproperty up 
  left join profiles p
  on up.user_id = p.id
left join property_filing pf on pf.property_id = up.property_id
left join user_roles ur on ur.user_id = _user_id

  WHERE (pf.id = _property_filing_id
  AND p.auth_user_id = _user_id)
OR ur.role = 'admin'
) 
$$;


ALTER FUNCTION "public"."is_member_of_filing"("_user_id" "uuid", "_property_filing_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_member_of_same_property"("_editing_user_id" "uuid", "_user_to_edit_id" bigint) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$

declare 
editing_profile_id bigint;


begin
select id from profiles where auth_user_id = _editing_user_id into editing_profile_id;

return (SELECT EXISTS (
select 1 from userproperty where property_id in
(select property_id from userproperty u where u.user_id =  _user_to_edit_id)
and is_manager is true
and user_id = editing_profile_id ));
end
$$;


ALTER FUNCTION "public"."is_member_of_same_property"("_editing_user_id" "uuid", "_user_to_edit_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_created_by"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.created_by := (SELECT id from profiles where auth_user_id = auth.uid());
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_created_by"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_property_filing"("_property_id" integer) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
declare
    existing_propertyfiling_id int;

begin
select
	id
from
	property_filing
where
	property_id = _property_id
	and status = 'open'
into
	existing_propertyfiling_id;

raise notice '%', existing_propertyfiling_id;
if(existing_propertyfiling_id is null) then
insert
	into
	property_filing (
      created_at,
	property_id,
	status
    )
values (now(),
_property_id,
'open')
    returning
        id
into
	existing_propertyfiling_id;
end if;

return existing_propertyfiling_id;
end;

$$;


ALTER FUNCTION "public"."update_property_filing"("_property_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_filing"("_userproperty_id" integer, "_property_id" integer) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
declare
    existing_userproperty_filing_id int;

existing_property_filing_id int;

begin
select
	id
from
	property_filing
where
	property_id = _property_id
	and status = 'open'
into
	existing_property_filing_id;

select
	id
from
	userproperty_filing
where
	userproperty_id = _userproperty_id
	and status = 'open'
	and propertyfiling_id = existing_property_filing_id into existing_userproperty_filing_id;

if(existing_property_filing_id is null) then
insert
	into
	property_filing (
      created_at,
	property_id,
	status
    )
values (now(),
_property_id,
'open')
    returning
        id
into
	existing_property_filing_id;
end if;

if(existing_userproperty_filing_id is null) then
insert
	into
	userproperty_filing(created_at,
	userproperty_id,
	propertyfiling_id,
	status)
values (now(),
_userproperty_id,
existing_property_filing_id,
'open');
end if;
return existing_property_filing_id;
end;

$$;


ALTER FUNCTION "public"."update_user_filing"("_userproperty_id" integer, "_property_id" integer) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "amount" numeric,
    "stripe_payment_id" "text",
    "method" "text",
    "created_by_user_id" bigint,
    "status" "text",
    "product" "jsonb",
    "stripe_invoice_id" "text",
    "stripe_session_id" "text",
    "property_id" bigint,
    "deleted" timestamp with time zone
);


ALTER TABLE "public"."payment" OWNER TO "postgres";


ALTER TABLE "public"."payment" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."Payment_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."countries" (
    "id" bigint NOT NULL,
    "english_short_name" "text",
    "french_short_name" "text",
    "alpha_2_code" "text",
    "alpha_3_code" "text",
    "numeric" bigint
);


ALTER TABLE "public"."countries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_notifications" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" bigint NOT NULL,
    "notification_type" "text" NOT NULL,
    "sent_by_user_id" bigint
);


ALTER TABLE "public"."email_notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_notifications" IS 'Store the latest time a notification email was automatically sent to a user.  One record per user.';



ALTER TABLE "public"."email_notifications" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."email_notifications_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."email_templates" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "template_html" "text" NOT NULL,
    "notification_type" "text" NOT NULL,
    "template_text" "text",
    "template_subject" "text" NOT NULL
);


ALTER TABLE "public"."email_templates" OWNER TO "postgres";


ALTER TABLE "public"."email_templates" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."email_templates_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."local_tribal" (
    "id" bigint NOT NULL,
    "code" "text",
    "description" "text"
);


ALTER TABLE "public"."local_tribal" OWNER TO "postgres";


ALTER TABLE "public"."profiles" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."profiles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."properties" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."properties_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."property_filing" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."property_filing_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."states" (
    "id" bigint NOT NULL,
    "code" "text",
    "state" "text"
);


ALTER TABLE "public"."states" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_roles" IS 'Application roles for each user.';



ALTER TABLE "public"."user_roles" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_roles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."userproperty" (
    "id" bigint NOT NULL,
    "property_id" bigint NOT NULL,
    "user_id" bigint,
    "property_role" "text" NOT NULL,
    "is_manager" boolean,
    "deleted" timestamp with time zone
);


ALTER TABLE "public"."userproperty" OWNER TO "postgres";


ALTER TABLE "public"."userproperty_filing" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."userproperty_filing_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."userproperty" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."userproperty_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_notifications"
    ADD CONSTRAINT "email_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_notification_type_key" UNIQUE ("notification_type");



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."local_tribal"
    ADD CONSTRAINT "local_tribal_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_identification_url_key" UNIQUE ("identification_url");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_filing"
    ADD CONSTRAINT "property_filing_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."states"
    ADD CONSTRAINT "states_ID_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."states"
    ADD CONSTRAINT "states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."userproperty_filing"
    ADD CONSTRAINT "userproperty_filing_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."userproperty"
    ADD CONSTRAINT "userproperty_pkey" PRIMARY KEY ("id");



CREATE OR REPLACE TRIGGER "insert_created_by" BEFORE INSERT ON "public"."properties" FOR EACH ROW EXECUTE FUNCTION "public"."set_created_by"();



ALTER TABLE ONLY "public"."email_notifications"
    ADD CONSTRAINT "email_notifications_sent_by_user_id_fkey" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_notifications"
    ADD CONSTRAINT "email_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment"
    ADD CONSTRAINT "payment_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_country_jurisdiction_id_fkey" FOREIGN KEY ("country_jurisdiction_id") REFERENCES "public"."countries"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_document_country_jurisdiction_id_fkey" FOREIGN KEY ("document_country_jurisdiction_id") REFERENCES "public"."countries"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_document_jurisdiction_local_tribal_id_fkey" FOREIGN KEY ("document_jurisdiction_local_tribal_id") REFERENCES "public"."local_tribal"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_document_state_id_fkey" FOREIGN KEY ("document_state_id") REFERENCES "public"."states"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "public"."states"("id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_country_jurisdiction_id_fkey" FOREIGN KEY ("country_jurisdiction_id") REFERENCES "public"."countries"("id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "public"."states"("id");



ALTER TABLE ONLY "public"."property_filing"
    ADD CONSTRAINT "property_filing_last_updated_by_user_id_fkey" FOREIGN KEY ("last_updated_by_user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."property_filing"
    ADD CONSTRAINT "property_filing_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."userproperty_filing"
    ADD CONSTRAINT "userproperty_filing_propertyfiling_id_fkey" FOREIGN KEY ("propertyfiling_id") REFERENCES "public"."property_filing"("id");



ALTER TABLE ONLY "public"."userproperty_filing"
    ADD CONSTRAINT "userproperty_filing_userproperty_id_fkey" FOREIGN KEY ("userproperty_id") REFERENCES "public"."userproperty"("id");



ALTER TABLE ONLY "public"."userproperty"
    ADD CONSTRAINT "userproperty_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."userproperty"
    ADD CONSTRAINT "userproperty_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



CREATE POLICY "Allow auth admin to read user roles" ON "public"."user_roles" FOR SELECT TO "supabase_auth_admin" USING (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."properties" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for managers only" ON "public"."userproperty" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable insert for members of same property" ON "public"."userproperty_filing" FOR INSERT WITH CHECK ("public"."is_member_of_filing"("auth"."uid"(), "propertyfiling_id"));



CREATE POLICY "Enable insert only for managers" ON "public"."property_filing" FOR INSERT WITH CHECK ("public"."is_manager_of"("auth"."uid"(), "property_id"));



CREATE POLICY "Enable read access for all users" ON "public"."states" FOR SELECT USING (true);



CREATE POLICY "Enable read access for anyone part of the property" ON "public"."userproperty" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for users part of the property" ON "public"."properties" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read access for users part of the property" ON "public"."userproperty_filing" FOR SELECT USING ("public"."is_member_of_filing"("auth"."uid"(), "propertyfiling_id"));



CREATE POLICY "Enable read access for users within the same property" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Enable read access only for members of the property" ON "public"."property_filing" FOR SELECT TO "authenticated" USING ("public"."is_member_of"("auth"."uid"(), "property_id"));



CREATE POLICY "Enable select for authenticated users only" ON "public"."payment" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable update access for managers" ON "public"."property_filing" FOR UPDATE USING ("public"."is_manager_of"("auth"."uid"(), "property_id")) WITH CHECK ("public"."is_manager_of"("auth"."uid"(), "property_id"));



CREATE POLICY "Enable updates for managers only" ON "public"."userproperty" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable updates for members of the same property" ON "public"."userproperty_filing" FOR UPDATE USING ("public"."is_member_of_filing"("auth"."uid"(), "propertyfiling_id")) WITH CHECK ("public"."is_member_of_filing"("auth"."uid"(), "propertyfiling_id"));



CREATE POLICY "anyone can select" ON "public"."countries" FOR SELECT USING (true);



CREATE POLICY "anyone can select" ON "public"."local_tribal" FOR SELECT USING (true);



ALTER TABLE "public"."countries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."local_tribal" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."properties" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."property_filing" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."userproperty" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."userproperty_filing" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users can update properties they are managers of" ON "public"."properties" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "supabase_auth_admin";






























































































































































































































GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON FUNCTION "public"."add_member_to_property"("property_id" integer, "first_name" "text", "last_name" "text", "email" "text", "property_role" "text", "is_manager" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."add_member_to_property"("property_id" integer, "first_name" "text", "last_name" "text", "email" "text", "property_role" "text", "is_manager" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_member_to_property"("property_id" integer, "first_name" "text", "last_name" "text", "email" "text", "property_role" "text", "is_manager" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."add_members_to_property"("members" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."add_members_to_property"("members" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_members_to_property"("members" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."properties" TO "anon";
GRANT ALL ON TABLE "public"."properties" TO "authenticated";
GRANT ALL ON TABLE "public"."properties" TO "service_role";



GRANT ALL ON FUNCTION "public"."add_property_with_owner"("name" "text", "address1" "text", "address2" "text", "city" "text", "country_jurisdiction_id" integer, "created_by" integer, "state_id" bigint, "tax_id_number" "text", "tax_id_type" "text", "zipcode" "text", "property_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_property_with_owner"("name" "text", "address1" "text", "address2" "text", "city" "text", "country_jurisdiction_id" integer, "created_by" integer, "state_id" bigint, "tax_id_number" "text", "tax_id_type" "text", "zipcode" "text", "property_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_property_with_owner"("name" "text", "address1" "text", "address2" "text", "city" "text", "country_jurisdiction_id" integer, "created_by" integer, "state_id" bigint, "tax_id_number" "text", "tax_id_type" "text", "zipcode" "text", "property_role" "text") TO "service_role";



GRANT ALL ON TABLE "public"."userproperty_filing" TO "anon";
GRANT ALL ON TABLE "public"."userproperty_filing" TO "authenticated";
GRANT ALL ON TABLE "public"."userproperty_filing" TO "service_role";



GRANT ALL ON FUNCTION "public"."add_userproperty_filing"("userproperty_id" integer, "filingdata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."add_userproperty_filing"("userproperty_id" integer, "filingdata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_userproperty_filing"("userproperty_id" integer, "filingdata" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."property_filing" TO "anon";
GRANT ALL ON TABLE "public"."property_filing" TO "authenticated";
GRANT ALL ON TABLE "public"."property_filing" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_filing_with_payment"("amount" numeric, "created_by_user_id" integer, "method" "text", "service_level" "text", "status" "text", "property_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_filing_with_payment"("amount" numeric, "created_by_user_id" integer, "method" "text", "service_level" "text", "status" "text", "property_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_filing_with_payment"("amount" numeric, "created_by_user_id" integer, "method" "text", "service_level" "text", "status" "text", "property_id" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "supabase_auth_admin";



GRANT ALL ON FUNCTION "public"."get_editable_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_editable_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_editable_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_editable_users"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_editable_users"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_editable_users"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_properties_for_user"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_properties_for_user"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_properties_for_user"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_properties_with_status_for_user"("_user_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_properties_with_status_for_user"("_user_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_properties_with_status_for_user"("_user_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_property_details"("_property_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_property_details"("_property_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_property_details"("_property_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."invite_members_to_property"("members" "json", "propertyid" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."invite_members_to_property"("members" "json", "propertyid" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."invite_members_to_property"("members" "json", "propertyid" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_manager_of"("_user_id" "uuid", "_property_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."is_manager_of"("_user_id" "uuid", "_property_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_manager_of"("_user_id" "uuid", "_property_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_manager_of_filing"("_user_id" "uuid", "_property_filing_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."is_manager_of_filing"("_user_id" "uuid", "_property_filing_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_manager_of_filing"("_user_id" "uuid", "_property_filing_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_member_of"("_user_id" "uuid", "_property_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."is_member_of"("_user_id" "uuid", "_property_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_member_of"("_user_id" "uuid", "_property_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_member_of_filing"("_user_id" "uuid", "_property_filing_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."is_member_of_filing"("_user_id" "uuid", "_property_filing_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_member_of_filing"("_user_id" "uuid", "_property_filing_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_member_of_same_property"("_editing_user_id" "uuid", "_user_to_edit_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."is_member_of_same_property"("_editing_user_id" "uuid", "_user_to_edit_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_member_of_same_property"("_editing_user_id" "uuid", "_user_to_edit_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_created_by"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_created_by"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_created_by"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_property_filing"("_property_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_property_filing"("_property_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_property_filing"("_property_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_filing"("_userproperty_id" integer, "_property_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_filing"("_userproperty_id" integer, "_property_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_filing"("_userproperty_id" integer, "_property_id" integer) TO "service_role";



























GRANT ALL ON TABLE "public"."payment" TO "anon";
GRANT ALL ON TABLE "public"."payment" TO "authenticated";
GRANT ALL ON TABLE "public"."payment" TO "service_role";



GRANT ALL ON SEQUENCE "public"."Payment_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."Payment_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."Payment_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."countries" TO "anon";
GRANT ALL ON TABLE "public"."countries" TO "authenticated";
GRANT ALL ON TABLE "public"."countries" TO "service_role";



GRANT ALL ON TABLE "public"."email_notifications" TO "anon";
GRANT ALL ON TABLE "public"."email_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."email_notifications" TO "service_role";



GRANT ALL ON SEQUENCE "public"."email_notifications_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."email_notifications_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."email_notifications_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."email_templates" TO "anon";
GRANT ALL ON TABLE "public"."email_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."email_templates" TO "service_role";



GRANT ALL ON SEQUENCE "public"."email_templates_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."email_templates_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."email_templates_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."local_tribal" TO "anon";
GRANT ALL ON TABLE "public"."local_tribal" TO "authenticated";
GRANT ALL ON TABLE "public"."local_tribal" TO "service_role";



GRANT ALL ON SEQUENCE "public"."profiles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."profiles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."profiles_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."properties_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."properties_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."properties_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."property_filing_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."property_filing_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."property_filing_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."states" TO "anon";
GRANT ALL ON TABLE "public"."states" TO "authenticated";
GRANT ALL ON TABLE "public"."states" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "service_role";
GRANT ALL ON TABLE "public"."user_roles" TO "supabase_auth_admin";



GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_roles_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."userproperty" TO "anon";
GRANT ALL ON TABLE "public"."userproperty" TO "authenticated";
GRANT ALL ON TABLE "public"."userproperty" TO "service_role";



GRANT ALL ON SEQUENCE "public"."userproperty_filing_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."userproperty_filing_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."userproperty_filing_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."userproperty_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."userproperty_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."userproperty_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
