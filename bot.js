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
 * Функция для обращения к AI-ассистенту
 */
async function getAIResponse(userMessage) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',  // Используем модель GPT-4o-mini
      messages: [
        { role: 'system', content: 'You are a helpful assistant trained to help with emotional and psychological issues.' },
        { role: 'user', content: userMessage },
      ],
    });

    const gptAnswer = completion.choices[0].message.content;
    return gptAnswer;
  } catch (error) {
    console.error('Ошибка запроса к OpenAI:', error);
    return 'К сожалению, не могу сейчас ответить. Попробуйте позже.';
  }
}

/**
 * Обработка команды /start
 * - Добавляем кнопки "Диалог" и "Дневник" с эмодзи
 */
bot.start((ctx) => {
  const userId = ctx.from.id;
  userSessions[userId] = {
    step: 1,
    status: 'basic', // По умолчанию базовый тариф
  };

  // Приветственное сообщение с кнопками и смайликами
  ctx.reply(
    `Привет! Я — бот-помощник. Как я могу помочь?`,
    Markup.inlineKeyboard([
      [Markup.button.callback('💬 Диалог', 'start_dialog'), Markup.button.callback('📓 Дневник', 'start_diary')]
    ])
  );
});

/**
 * Обработка нажатий на кнопки "Диалог" и "Дневник"
 */
bot.on('callback_query', async (ctx) => {
  const userId = ctx.from.id;
  const callbackData = ctx.callbackQuery.data;

  // Немедленно отвечаем на callbackQuery, чтобы избежать таймаута
  await ctx.answerCbQuery();

  if (callbackData === 'start_dialog') {
    const message = 'Привет! Как ты себя чувствуешь сегодня?';
    ctx.replyWithChatAction('typing');
    ctx.reply(message);
    userSessions[userId].step = 'dialog';
  }

  if (callbackData === 'start_diary') {
    ctx.reply('Этот раздел пока в разработке. Ожидайте.');
  }
});

/**
 * Обработка текстовых сообщений (для диалога с AI-ассистентом)
 */
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const userText = ctx.message.text.trim();

  if (userSessions[userId].step === 'dialog') {
    // Если мы в диалоге, отправляем сообщение в AI-ассистент
    ctx.replyWithChatAction('typing'); // Анимация

    const response = await getAIResponse(userText);

    // Отправляем ответ от AI
    ctx.reply(response);

    // После ответа предлагаем кнопки
    ctx.reply(
      'Как ты себя чувствуешь после применения техники?',
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Помогло', 'helped')],
        [Markup.button.callback('❌ Не помогло', 'not_helped')],
        [Markup.button.callback('🤔 Проблема не решена полностью', 'partially_helped')]
      ])
    );
  }
});

/**
 * Обработка выбора "Помогло", "Не помогло" и "Проблема не решена полностью"
 */
bot.on('callback_query', async (ctx) => {
  const userId = ctx.from.id;
  const callbackData = ctx.callbackQuery.data;

  // Немедленно отвечаем на callbackQuery, чтобы избежать таймаута
  await ctx.answerCbQuery();

  if (callbackData === 'helped') {
    ctx.reply(
      'Рад, что смог помочь! Для углубленной проработки и получения большего количества техник, я могу предложить подписку. Она включает доступ к психоанализу и "Дневнику чувств".',
      Markup.inlineKeyboard([
        [Markup.button.callback('💳 Оформить подписку', 'subscribe')]
      ])
    );
  } else if (callbackData === 'not_helped') {
    ctx.reply(
      'Жаль, что это не сработало. Давай попробуем что-то другое. Вот новая техника: сосредоточься на своем дыхании в течение 1-2 минут, делая медленные вдохи и выдохи.'
    );
    userSessions[userId].step = 'dialog';
  } else if (callbackData === 'partially_helped') {
    ctx.reply(
      'Я рад, что частично помогло. Чтобы доработать результат, мы можем попробовать более глубокий подход. Как насчет этого?'
    );
    userSessions[userId].step = 'dialog';
  }

  if (callbackData === 'subscribe') {
    ctx.reply(
      'Спасибо за выбор подписки! Теперь у вас неограниченные обращения и доступ к глубокому психоанализу.'
    );
  }
});

/**
 * Запуск бота
 */
bot.launch().then(() => {
  console.log('Бот запущен!');
}).catch((err) => {
  console.error('Ошибка при запуске бота:', err);
});
