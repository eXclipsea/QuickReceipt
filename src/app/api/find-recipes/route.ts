import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

interface PantryItem {
  id: string;
  name: string;
  quantity: string;
  expiryDate?: string;
  isOpened: boolean;
  addedDate: string;
  priority?: number;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { pantryItems }: { pantryItems: PantryItem[] } = await request.json();

    if (!pantryItems || pantryItems.length === 0) {
      return NextResponse.json({ error: 'No pantry items provided' }, { status: 400 });
    }

    // Prioritize items that are opened or expiring soon
    const prioritizedItems = pantryItems.map((item: PantryItem) => {
      let priority = 0;
      if (item.isOpened) priority += 10;
      if (item.expiryDate) {
        const daysUntilExpiry = Math.ceil((new Date(item.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiry < 0) priority += 20; // Expired items get highest priority
        else if (daysUntilExpiry <= 3) priority += 15; // Expiring soon
        else if (daysUntilExpiry <= 7) priority += 5; // Expiring within a week
      }
      return { ...item, priority };
    }).sort((a: PantryItem & { priority: number }, b: PantryItem & { priority: number }) => b.priority - a.priority);

    const itemsList = prioritizedItems.map((item: PantryItem) => item.name).join(', ');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a creative chef who specializes in creating recipes from available ingredients.
          
          Given a list of pantry items, suggest 3 recipes that:
          1. Primarily use the provided ingredients
          2. Prioritize ingredients that are opened or expiring soon
          3. Are realistic and achievable for home cooking
          4. Require minimal additional ingredients (max 2-3 common items not in the list)
          
          Return a JSON array with this structure:
          [
            {
              "id": "recipe_1",
              "name": "Recipe Name",
              "ingredients": ["ingredient1", "ingredient2", "ingredient3"],
              "matchScore": 85,
              "timeToCook": "30 mins"
            }
          ]
          
          The matchScore should be a percentage (0-100) indicating how well the recipe matches the available ingredients.
          Time to cook should be a reasonable estimate.`
        },
        {
          role: 'user',
          content: `I have these pantry items: ${itemsList}
          
          Please suggest 3 recipes that would work well with these ingredients, prioritizing items that need to be used soon. Return the response in the specified JSON format.`
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    try {
      const recipes = JSON.parse(content);
      return NextResponse.json({ recipes });
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

  } catch (error) {
    console.error('Error finding recipes:', error);
    return NextResponse.json({ error: 'Failed to find recipes' }, { status: 500 });
  }
}
