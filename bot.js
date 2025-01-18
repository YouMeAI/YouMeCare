require('dotenv').config(); // Загружаем переменные окружения

const { Telegraf, Markup } = require('telegraf'); // Библиотека для Telegram
const { OpenAI } = require('openai');            // Новый способ подключения к OpenAI SDK

// Инициализация OpenAI с API-ключом из переменных окружения
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Использование API-ключа из .env
});

/**
 * Устанавливаем ваш токен Telegram
 */
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'ВАШ_ТЕЛЕГРАМ_ТОКЕН';

/**
 * Инициализация Telegram-бота
 */
const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

/**
 * Храним состояние пользователя
 */
let userSessions = {};

/**
 * Функция для обращения к GPT-ассистенту
 */
async function getAIResponse(userMessage) {
  try {
    console.log(`[GPT запрос] Вопрос пользователя: ${userMessage}`);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',  // Используем модель GPT-4o-mini
      messages: [
        { role: 'system', content: 'You are a helpful assistant trained to help with emotional and psychological issues.' },
        { role: 'user', content: userMessage },
      ],
    });

    const gptAnswer = completion.choices[0].message.content;
    console.log(`[GPT ответ] ${gptAnswer}`);
    return gptAnswer;
  } catch (error) {
    console.error(`[Ошибка GPT] ${error.message}`);
    return 'К сожалению, я не могу сейчас ответить. Попробуйте позже.';
  }
}

/**
 * Обработка команды /start
 */
bot.start((ctx) => {
  const userId = ctx.from.id;
  userSessions[userId] = {
    step: 1,
    status: 'basic', // По умолчанию базовый тариф
  };

  // Приветственное сообщение с кнопками
  ctx.reply(
    `Привет! Я — бот-помощник. Как я могу помочь?`,
    Markup.inlineKeyboard([
      [Markup.button.callback('💬 Диалог', 'start_dialog'), Markup.button.callback('📓 Дневник', 'start_diary')]
    ])
  );
  console.log(`[Start] Пользователь ${userId} запустил бота.`);
});

/**
 * Обработка кнопок "Диалог" и "Дневник"
 */
bot.on('callback_query', async (ctx) => {
  const userId = ctx.from.id;
  const callbackData = ctx.callbackQuery.data;

  await ctx.answerCbQuery(); // Отвечаем на callback, чтобы избежать таймаута

  if (callbackData === 'start_dialog') {
    console.log(`[Диалог] Пользователь ${userId} начал диалог.`);
    ctx.reply('Привет! Как ты себя чувствуешь сегодня?');
    userSessions[userId].step = 'dialog';
  }

  if (callbackData === 'start_diary') {
    console.log(`[Дневник] Пользователь ${userId} выбрал дневник.`);
    ctx.reply('Этот раздел пока в разработке. Ожидайте.');
  }
});

/**
 * Обработка текстовых сообщений в диалоге
 */
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const userText = ctx.message.text.trim();

  if (userSessions[userId].step === 'dialog') {
    ctx.replyWithChatAction('typing'); // Показ анимации "набирает текст"

    const response = await getAIResponse(userText);

    ctx.reply(response);

    // Добавляем кнопки обратной связи
    ctx.reply(
      'Как ты себя чувствуешь после применения техники?',
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Помогло', 'helped')],
        [Markup.button.callback('❌ Не помогло', 'not_helped')],
        [Markup.button.callback('🤔 Проблема не решена полностью', 'partially_helped')]
      ])
    );
    console.log(`[Диалог] Пользователь ${userId} получил ответ и кнопки.`);
  }
});

/**
 * Обработка кнопок "Помогло", "Не помогло" и "Проблема не решена полностью"
 */
bot.on('callback_query', async (ctx) => {
  const userId = ctx.from.id;
  const callbackData = ctx.callbackQuery.data;

  await ctx.answerCbQuery(); // Отвечаем на callback

  switch (callbackData) {
    case 'helped':
      console.log(`[Обратная связь] Пользователь ${userId} выбрал "Помогло".`);
      ctx.reply(
        'Рад, что смог помочь! Для углубленной проработки я могу предложить подписку. Она включает доступ к психоанализу и "Дневнику чувств".',
        Markup.inlineKeyboard([
          [Markup.button.callback('💳 Оформить подписку', 'subscribe')]
        ])
      );
      break;

    case 'not_helped':
      console.log(`[Обратная связь] Пользователь ${userId} выбрал "Не помогло".`);
      ctx.reply('Жаль, что это не сработало. Давай попробуем что-то другое. Вот новая техника: сделай глубокий вдох, сосредоточься на дыхании 1-2 минуты.');
      userSessions[userId].step = 'dialog';
      break;

    case 'partially_helped':
      console.log(`[Обратная связь] Пользователь ${userId} выбрал "Проблема не решена полностью".`);
      ctx.reply('Я рад, что частично помогло. Продолжим работу и попробуем углубиться.');
      userSessions[userId].step = 'dialog';
      break;

    case 'subscribe':
      console.log(`[Подписка] Пользователь ${userId} выбрал подписку.`);
      ctx.reply('Спасибо за выбор подписки! Теперь у вас неограниченные обращения и доступ к глубокому психоанализу.');
      break;

    default:
      console.error(`[Ошибка] Неизвестный callback_data: ${callbackData}`);
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
