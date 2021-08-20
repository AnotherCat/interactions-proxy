-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages(
    message_id bigint not null,
    channel_id bigint not null,
    account_id bigint not null,
    guild_id bigint not null,
    log_channel_id bigint,
    log_message_id bigint,
    proxy_id varchar(15) not null,
    CONSTRAINT UNIQUE_MESSAGE UNIQUE (message_id, channel_id)
);

DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles 
      WHERE  rolname = 'authenticator') THEN

      CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'password';
   END IF;
END
$do$;

DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles 
      WHERE  rolname = 'anon') THEN

      CREATE ROLE anon;
      REVOKE ALL ON schema public FROM public;
      GRANT anon TO authenticator;
   END IF;
END
$do$;



DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles 
      WHERE  rolname = 'read') THEN

      CREATE ROLE read;
      GRANT USAGE ON schema public TO read;
      GRANT SELECT ON ALL TABLES IN SCHEMA "public" TO read;
      GRANT read TO authenticator;
   END IF;
END
$do$;

DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles 
      WHERE  rolname = 'readwrite') THEN

      CREATE ROLE readwrite;
      GRANT ALL ON SCHEMA public TO readwrite;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "public" TO readwrite;
      GRANT readwrite TO authenticator;
   END IF;
END
$do$;
