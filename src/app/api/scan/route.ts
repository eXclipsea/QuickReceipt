import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File;

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const bytes = await image.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Act as a professional bookkeeper. Extract the Merchant Name, Date (YYYY-MM-DD), Total Amount (numeric), and a Category (e.g., Groceries, Dining, Transport) from this receipt. Return ONLY a valid JSON object.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${image.type};base64,${base64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    try {
      const parsed = JSON.parse(content);
      return NextResponse.json(parsed);
    } catch (parseError) {
      return NextResponse.json({ error: 'Invalid JSON response from AI' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error processing receipt:', error);
    return NextResponse.json({ error: 'Failed to process receipt' }, { status: 500 });
  }
}
