import { supabase } from './supabase'

export type Rating = 1 | -1

export async function saveFeedback(params: {
  chatId: string
  messageIndex: number
  rating: Rating
  question: string
  answer: string
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('feedback').upsert({
    chat_id: params.chatId,
    message_index: params.messageIndex,
    user_id: user.id,
    rating: params.rating,
    question: params.question,
    answer: params.answer,
  }, { onConflict: 'chat_id,message_index' })
}
