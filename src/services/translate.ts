import api from '@/lib/axios';

export const translateService = {
  translate: async (text: string, targetLang: string): Promise<string> => {
    const res = await api.post('/api/translate', { text, targetLang });
    return res.data.data.translatedText;
  },
};
