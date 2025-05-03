//src/services/agent.ts

export async function getAgentReply(message: string): Promise<string> {
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    return data.reply;
  }