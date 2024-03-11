require("dotenv/config");
const { Client } = require("discord.js");
const { OpenAI, OpenAIError } = require("openai");

const client = new Client({
  intents: ["Guilds", "GuildMembers", "GuildMessages", "MessageContent"],
});

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

const INGORE_PREFIX = "!";
const CHANNELS = ["1216817176942743693"];

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) {
    console.log("Bot message");
    return;
  }

  if (!CHANNELS.includes(message.channel.id)) {
    console.log("Not in channel");
    return;
  } //could be message.channelID instead

  if (
    message.content.startsWith(INGORE_PREFIX) &&
    !message.mentions.users.has(client.user.id)
  ) {
    console.log("Not a command");
    return;
  }

  await message.channel.sendTyping();

  const sendTypingInterval = setInterval(() => {
    message.channel.sendTyping();
  }, 5000);

  let conversation = [];

  conversation.push({
    role: "system",
    content: `#Role: 
    You are a subject matter expert in esports, focused on delivering precise answers based on specific content sources.
    
    #Objective: 
    Your primary objective is to answer user questions. If unable to answer, inform the user politely of this limitation.
    
    #Audience: 
    You will be engaging with a wide range of individuals, responding only to queries that relate to the content in this prompt or subsequent messages.
    
    #Style: 
    Your writing style is clear, objective, and concise. Your responses should be factual and directly related to the information available in this prompt or subsequent messages.
    
    #Context: 
    Your responses should directly use or paraphrase the content from this prompt or subsequent messages, maintaining the original meaning. Prioritize understanding the user's question and ask clarifying questions if the user's request isn't clear.
    
    #Other Rules: 
    - Never invent information in your responses. Only engage with questions that can be answered with the content from this prompt or subsequent messages.
    - In cases of conflicting information, present the latest information as correct. 
    - If you lack sufficient information to provide an accurate answer, ask for more details. 
    - Always remain polite, even when unable to answer a question.`,
  });

  let prevMessages = await message.channel.messages.fetch({ limit: 10 });
  prevMessages.reverse();

  prevMessages.forEach((msg) => {
    if (msg.author.bot && msg.author.id !== client.user.id) return;

    if (msg.content.startsWith(INGORE_PREFIX)) return;

    const username = msg.author.username
      .replace(/\s+/g, "_")
      .replace(/[^\w\s]/gi, "");

    if (msg.author.id === client.user.id) {
      conversation.push({
        role: "assistant",
        name: username,
        content: msg.content,
      });
      return;
    }

    conversation.push({
      role: "user",
      name: username,
      content: msg.content,
    });
  });

  const response = await openai.chat.completions
    .create({
      model: "gpt-3.5-turbo",
      messages: conversation,
    })
    .catch((err) => {
      console.error("OpenAI Error:\n", err);
      return;
    });

  clearInterval(sendTypingInterval);

  if (!response) {
    message.reply(
      "I'm sorry, I am having trouble with the OpenAI API. Try again later."
    );
    return;
  }

  const responseMessage = response.choices[0].message.content;
  const chunkSizeLimit = 2000;

  for (let i = 0; i < responseMessage.length; i += chunkSizeLimit) {
    const chunk = responseMessage.substring(i, i + chunkSizeLimit);
    await message.reply(chunk);
  }

  message.reply(response.choices[0].message.content);
});

client.login(process.env.DISCORD_TOKEN);
