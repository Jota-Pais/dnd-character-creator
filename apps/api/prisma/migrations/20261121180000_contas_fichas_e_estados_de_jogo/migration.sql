-- A primeira forma do banco do Criador de Ficha: as contas (users), os aparelhos conectados (sessions), as
-- fichas de qualquer sistema (characters) e o estado de jogo de cada uma (play_states).
--
-- O porquê de cada coluna está no cabeçalho e nos comentários de prisma/schema.prisma. O SQL abaixo
-- é o que o Prisma gera do schema (prisma migrate diff --from-empty --to-schema).

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" VARCHAR(100) NOT NULL,
    "change_counter" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "user_agent" VARCHAR(300),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "user_id" UUID NOT NULL,
    "id" VARCHAR(120) NOT NULL,
    "system" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL DEFAULT '',
    "step" VARCHAR(60) NOT NULL,
    "draft" JSONB NOT NULL,
    "schema" INTEGER NOT NULL,
    "client_updated_at" TIMESTAMPTZ(3) NOT NULL,
    "revision" INTEGER NOT NULL,
    "change_seq" BIGINT NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("user_id","id")
);

-- CreateTable
CREATE TABLE "play_states" (
    "user_id" UUID NOT NULL,
    "character_id" VARCHAR(120) NOT NULL,
    "state" JSONB NOT NULL,
    "schema" INTEGER NOT NULL,
    "client_updated_at" TIMESTAMPTZ(3) NOT NULL,
    "revision" INTEGER NOT NULL,
    "change_seq" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "play_states_pkey" PRIMARY KEY ("user_id","character_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "characters_user_id_change_seq_idx" ON "characters"("user_id", "change_seq");

-- CreateIndex
CREATE INDEX "play_states_user_id_change_seq_idx" ON "play_states"("user_id", "change_seq");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "play_states" ADD CONSTRAINT "play_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "play_states" ADD CONSTRAINT "play_states_user_id_character_id_fkey" FOREIGN KEY ("user_id", "character_id") REFERENCES "characters"("user_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;

