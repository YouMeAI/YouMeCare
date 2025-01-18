require('dotenv').config();

const { Telegraf, Markup } = require('telegraf');
const { OpenAI } = require('openai');

// Инициализация OpenAI с API-ключом
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

let userSessions = {};

/**
 * Функция для обращения к GPT-ассистенту через Thread
 */
async function getAIResponse(userId, userMessage) {
  try {
    const threadId = userSessions[userId].threadId;
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant trained to help with emotional and psychological issues.' },
        ...userSessions[userId].context,
        { role: 'user', content: userMessage },
      ],
      user: String(userId), // Преобразуем userId в строку
      threadId,
    });

    const assistantReply = response.choices[0].message.content;
    userSessions[userId].context.push({ role: 'assistant', content: assistantReply });
    return assistantReply;
  } catch (error) {
    console.error(`[Ошибка GPT] ${error.message}`);
    return 'Извините, я не могу сейчас ответить. Попробуйте позже.';
  }
}

/**
 * Обработка команды /start
 */
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  userSessions[userId] = {
    context: [],
    step: 'menu',
    threadId: `thread-${userId}-${Date.now()}`,
  };

  await ctx.reply(
    `Привет! Я — бот-помощник. Чем могу помочь?`,
    Markup.inlineKeyboard([
      [Markup.button.callback('💬 Диалог', 'start_dialog'), Markup.button.callback('📓 Дневник', 'start_diary')],
    ])
  );
});

/**
 * Обработка кнопок "Диалог" и "Дневник"
 */
bot.on('callback_query', async (ctx) => {
  const userId = ctx.from.id;
  const callbackData = ctx.callbackQuery.data;

  await ctx.answerCbQuery();

  if (callbackData === 'start_dialog') {
    await ctx.reply('Расскажи, что тебя тревожит?');
    userSessions[userId].step = 'dialog';
  }

  if (callbackData === 'start_diary') {
    await ctx.reply('Этот раздел пока в разработке. Ожидайте.');
  }
});

/**
 * Обработка текста пользователя в диалоге
 */
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const userText = ctx.message.text.trim();

  if (!userSessions[userId]) {
    userSessions[userId] = { context: [], step: 'menu' };
  }

  if (userSessions[userId].step === 'dialog') {
    // Первый этап: задаем уточняющие вопросы
    const stepCount = userSessions[userId].context.length;

    if (stepCount < 3) {
      ctx.replyWithChatAction('typing');

      const assistantReply = await getAIResponse(userId, userText);
      await ctx.reply(assistantReply);
      userSessions[userId].context.push({ role: 'user', content: userText });
    } else {
      // После 3 вопросов предлагаем технику и кнопки обратной связи
      await ctx.reply(
        'Вот техника, которая может помочь: попробуй сосредоточиться на дыхании и сделать 10 медленных вдохов и выдохов. Как ты себя чувствуешь после этого?',
        Markup.inlineKeyboard([
          [Markup.button.callback('✅ Помогло', 'helped')],
          [Markup.button.callback('❌ Не помогло', 'not_helped')],
          [Markup.button.callback('🤔 Немного легче', 'partially_helped')],
        ])
      );
      userSessions[userId].step = 'feedback';
    }
  }
});

/**
 * Обработка обратной связи от кнопок
 */
bot.on('callback_query', async (ctx) => {
  const userId = ctx.from.id;
  const callbackData = ctx.callbackQuery.data;

  await ctx.answerCbQuery();

  if (userSessions[userId].step === 'feedback') {
    if (callbackData === 'helped') {
      await ctx.reply(
        'Рад, что смог помочь! Я могу предложить подписку с неограниченными обращениями, доступом к психоанализу и "Дневнику чувств".',
        Markup.inlineKeyboard([
          [Markup.button.callback('💳 Оформить подписку', 'subscribe')],
        ])
      );
    } else if (callbackData === 'not_helped' || callbackData === 'partially_helped') {
      const message = callbackData === 'not_helped'
        ? 'Жаль, что это не помогло. Давай попробуем что-то другое. Что именно тебе показалось сложным?'
        : 'Рад, что немного помогло. Можем продолжить работу над улучшением. Что больше всего беспокоит сейчас?';

      await ctx.reply(message);
      userSessions[userId].step = 'dialog';
    } else if (callbackData === 'subscribe') {
      await ctx.reply(
        'Подписка оформлена! Теперь у вас есть доступ к неограниченному чату, психоанализу и "Дневнику чувств".'
      );
    }
  }
});

/**
 * Запуск бота
 */
bot.launch().then(() => {
  console.log('Бот запущен!');
}).catch((err) => {
  console.error(`[Ошибка запуска] ${err.message}`);
});
