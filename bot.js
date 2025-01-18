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
 * Функция для обращения к GPT-ассистенту
 */
async function getAIResponse(userId, userMessage, context = []) {
  try {
    const messages = [
      { role: 'system', content: 'You are a helpful, empathetic assistant trained to help with emotional and psychological issues.' },
      ...context,
      { role: 'user', content: userMessage },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
    });

    const response = completion.choices[0].message.content;
    userSessions[userId].context.push({ role: 'assistant', content: response });
    return response;
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
    step: 'problem', // Начальная стадия
  };

  await ctx.reply(
    `Привет! Я — бот-помощник. Расскажи, что тебя тревожит?`,
    Markup.inlineKeyboard([
      [Markup.button.callback('💬 Начать диалог', 'start_dialog')],
    ])
  );
});

/**
 * Обработка кнопки "Начать диалог"
 */
bot.on('callback_query', async (ctx) => {
  const userId = ctx.from.id;
  const callbackData = ctx.callbackQuery.data;

  await ctx.answerCbQuery();

  if (callbackData === 'start_dialog') {
    await ctx.reply('Что тебя тревожит? Расскажи подробнее.');
    userSessions[userId].step = 'dialog';
  }
});

/**
 * Обработка текста пользователя
 */
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const userText = ctx.message.text.trim();

  if (!userSessions[userId]) {
    userSessions[userId] = { context: [], step: 'problem' };
  }

  if (userSessions[userId].step === 'dialog') {
    // Генерация ответа от GPT
    ctx.replyWithChatAction('typing');
    const response = await getAIResponse(userId, userText, userSessions[userId].context);

    // Добавляем ответ в контекст и отправляем пользователю
    userSessions[userId].context.push({ role: 'user', content: userText });
    await ctx.reply(response);

    // Предлагаем упражнение и кнопки обратной связи
    await ctx.reply(
      'Вот техника, которая может помочь: попробуй расслабиться, сделав глубокий вдох и выдох, сосредотачиваясь на дыхании. После этого нажми одну из кнопок ниже.',
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Помогло', 'helped')],
        [Markup.button.callback('❌ Не помогло', 'not_helped')],
        [Markup.button.callback('🤔 Немного легче', 'partially_helped')],
      ])
    );

    userSessions[userId].step = 'feedback';
  }
});

/**
 * Обработка обратной связи
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
