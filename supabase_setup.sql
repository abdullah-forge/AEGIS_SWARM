-- Run this in your Supabase SQL Editor

-- 1. Enable the pgvector extension to work with embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the threats table
CREATE TABLE IF NOT EXISTS threats (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  content text not null,
  embedding vector(384), -- all-MiniLM-L6-v2 outputs 384 dimensions
  threat_type text not null,
  confidence real not null,
  agent_source text not null
);

-- 3. Create the vector search function (RPC)
CREATE OR REPLACE FUNCTION match_threats (
  query_embedding vector(384),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  threat_type text,
  confidence real,
  similarity float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    threats.id,
    threats.content,
    threats.threat_type,
    threats.confidence,
    1 - (threats.embedding <=> query_embedding) as similarity
  FROM threats
  WHERE 1 - (threats.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
