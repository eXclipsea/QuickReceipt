import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a pantry inventory expert. Analyze the image and identify food items, ingredients, and pantry staples.
          
          Return a JSON array of items with the following structure:
          [
            {
              "name": "item name",
              "quantity": "estimated quantity or count",
              "expiryDate": "YYYY-MM-DD if visible, otherwise omit"
            }
          ]
          
          Focus on common pantry items like:
          - Canned goods, pasta, rice, grains
          - Spices, oils, condiments
          - Snacks, breakfast items
          - Beverages
          - Any visible food items
          
          Be conservative - only include items you can clearly identify.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please identify all pantry and food items in this image and return them in the specified JSON format.'
            },
            {
              type: 'image_url',
              image_url: {
                url: image
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    try {
      const items = JSON.parse(content);
      return NextResponse.json({ items });
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error analyzing pantry image:', error);
    return NextResponse.json({ error: 'Failed to analyze image' }, { status: 500 });
  }
}
