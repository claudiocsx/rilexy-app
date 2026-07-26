export const INTENTIONS = {
  direct: { emoji: '🔥', label: 'Direto ao Ponto', color: '#EF4444', replyText: 'Olá! Vi que você também está no modo \'Direto ao Ponto\' por aqui. Vamos conversar e ver se estamos na mesma sintonia?' },
  bar: { emoji: '🍸', label: 'Barzinho', color: '#F59E0B', replyText: 'Oi! Vi que você também está afim de um barzinho hoje. Alguma sugestão de lugar na nossa região?' },
  party: { emoji: '⚡', label: 'Agitação', color: '#A855F7', replyText: 'Opa! Estou no modo \'Agitação\' e vi que você também está. Bora aproveitar o momento?' },
  chat: { emoji: '💬', label: 'Chat & Confiança', color: '#3B82F6', replyText: 'Oi, tudo bem? Vi seu status e gostaria de te conhecer melhor. Como está sendo sua noite?' },
} as const;

export type IntentionType = keyof typeof INTENTIONS;
