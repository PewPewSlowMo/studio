// This is a server action.
'use server';
/**
 * @fileOverview An AI agent that categorizes call recordings based on keywords and sentiment.
 *
 * - summarizeCall - A function that handles the call summarization process.
 * - SummarizeCallInput - The input type for the summarizeCall function.
 * - SummarizeCallOutput - The return type for the summarizeCall function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeCallInputSchema = z.object({
  recordingDataUri: z
    .string()
    .describe(
      "A call recording, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  transcript: z.string().describe('The transcript of the call recording.'),
});
export type SummarizeCallInput = z.infer<typeof SummarizeCallInputSchema>;

const SummarizeCallOutputSchema = z.object({
  categories: z
    .array(z.string())
    .describe('Categories that the call recording belongs to.'),
  sentiment: z
    .string()
    .describe('The overall sentiment of the call recording.'),
  summary: z.string().describe('A short summary of the call recording.'),
});
export type SummarizeCallOutput = z.infer<typeof SummarizeCallOutputSchema>;

export async function summarizeCall(input: SummarizeCallInput): Promise<SummarizeCallOutput> {
  return summarizeCallFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeCallPrompt',
  input: {schema: SummarizeCallInputSchema},
  output: {schema: SummarizeCallOutputSchema},
  prompt: `You are an AI expert in call center quality assurance.

You will use the call transcript and recording to categorize the call, determine the sentiment, and create a short summary.

Transcript: {{{transcript}}}
Recording: {{media url=recordingDataUri}}

Categories: {{categories}}
Sentiment: {{sentiment}}
Summary: {{summary}}`,
});

const summarizeCallFlow = ai.defineFlow(
  {
    name: 'summarizeCallFlow',
    inputSchema: SummarizeCallInputSchema,
    outputSchema: SummarizeCallOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
