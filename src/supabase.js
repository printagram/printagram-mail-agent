import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Check if message already processed
export async function isDuplicate(gmailMessageId) {
  const { data } = await supabase
    .from('email_log')
    .select('id')
    .eq('gmail_message_id', gmailMessageId)
    .maybeSingle();

  return !!data;
}

// Save processed email to log
export async function logEmail({
  gmailMessageId,
  gmailThreadId,
  receivedAt,
  fromEmail,
  fromName,
  subject,
  snippet,
  category,
  summary,
  confidence,
  language,
  rawResponse,
}) {
  const { error } = await supabase.from('email_log').insert({
    gmail_message_id: gmailMessageId,
    gmail_thread_id: gmailThreadId,
    received_at: receivedAt,
    from_email: fromEmail,
    from_name: fromName,
    subject,
    snippet,
    category,
    summary,
    confidence,
    language,
    raw_response: rawResponse,
  });

  if (error) throw error;
}
