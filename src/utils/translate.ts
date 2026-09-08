import { useERPStore } from '../store';

export const translateText = async (text: string, target: string = 'ar'): Promise<string> => {
  if (!text || !text.trim()) return '';
  try {
    const token = useERPStore.getState().token;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/translate', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, q: text, source: 'en', target })
    });
    if (!res.ok) throw new Error('Translation failed');
    const data = await res.json();
    return data.translation || data.translatedText || '';
  } catch (error) {
    console.error('Translation error:', error);
    return '';
  }
};
