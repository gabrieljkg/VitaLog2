-- Execute este script no SQL Editor do seu Supabase para adicionar as novas funcionalidades de Caixa

-- 1. Adicionar coluna de método de pagamento e barcode na tabela de vendas
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method text CHECK (payment_method IN ('dinheiro', 'cartao_credito', 'cartao_debito', 'pix', 'misto'));
ALTER TABLE sales ADD COLUMN IF NOT EXISTS barcode text;

-- 2. Criar tabela de controle de caixa (cash_registers)
CREATE TABLE IF NOT EXISTS cash_registers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  opened_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  closed_at timestamp with time zone,
  initial_balance numeric NOT NULL DEFAULT 0,
  final_balance numeric,
  status text NOT NULL CHECK (status IN ('open', 'closed')) DEFAULT 'open'
);

-- 3. Adicionar referência do caixa na tabela de vendas (opcional, mas recomendado para relatórios)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cash_register_id uuid REFERENCES cash_registers(id);

-- 4. Políticas de Segurança (RLS) para cash_registers
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura de caixas para todos" 
ON cash_registers FOR SELECT 
USING (true);

CREATE POLICY "Permitir inserção de caixas para todos" 
ON cash_registers FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Permitir atualização de caixas para todos" 
ON cash_registers FOR UPDATE 
USING (true);

-- 5. Configurações por Tenant / Loja (SaaS)
CREATE TABLE IF NOT EXISTS store_settings (
    user_id uuid REFERENCES auth.users(id) PRIMARY KEY,
    name text,
    document text,
    ie text, -- Inscrição Estadual
    address text,
    phone text,
    message text,
    focus_token_prod text,
    focus_token_homolog text,
    focus_environment text CHECK (focus_environment IN ('producao', 'homologacao')) DEFAULT 'homologacao',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings"
    ON store_settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
    ON store_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
    ON store_settings FOR UPDATE
    USING (auth.uid() = user_id);

-- 6. Adicionar campos de retorno de NFC-e na tabela de vendas
ALTER TABLE sales ADD COLUMN IF NOT EXISTS nfce_url_pdf text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS nfce_url_xml text;

