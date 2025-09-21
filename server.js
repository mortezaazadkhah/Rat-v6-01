// server.js
// بازنویسی شده توسط: مستر آزاد (@metanoia_34)
// توضیحات: نسخه‌ای ساده، امن و فارسی‌سازی‌شده از سرور تلگرام/اکسپرس

const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');

const DATA_PATH = path.join(__dirname, 'data.json');

// load config (simple sync read; در محیط production بهتر است از متد غیرهمزمان استفاده شود)
if (!fs.existsSync(DATA_PATH)) {
  console.error('فایل data.json پیدا نشد. لطفاً data.json را با مقادیر لازم پر کنید.');
  process.exit(1);
}

let raw = fs.readFileSync(DATA_PATH, 'utf8');
let config;
try {
  config = JSON.parse(raw);
} catch (err) {
  console.error('خطا در خواندن data.json:', err);
  process.exit(1);
}

const TOKEN = config.token || '';
const DEFAULT_CHAT_ID = config.id || '';
const HOST = config.host || '/';
const DEFAULT_TEXT = config.text || 'سلام! این یک پیام نمونه است.';
const DEVELOPER = (config.developer && config.developer.name) ? config.developer : { name: 'مستر آزاد', telegram: '@metanoia_34' };

if (!TOKEN) {
  console.error('توکن ربات در data.json تنظیم نشده است. لطفاً مقدار "token" را قرار دهید.');
  process.exit(1);
}

// Use polling for simplicity; اگر ترجیح می‌دهی وبهوک، می‌توانم وبهوک اضافه کنم.
const bot = new TelegramBot(TOKEN, { polling: true });

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// مسیر ساده برای بررسی وضعیت
app.get('/', (req, res) => {
  res.send(`ربات بالا است — توسعه‌دهنده: ${DEVELOPER.name} (${DEVELOPER.telegram})`);
});

// تعریف کیبورد‌های فارسی (دکمه‌های اصلی ربات)
function mainKeyboard() {
  return {
    reply_markup: {
      resize_keyboard: true,
      keyboard: [
        [{ text: '📩 ارسال پیام' }, { text: 'ℹ️ راهنما' }],
        [{ text: '⚙️ تنظیمات' }, { text: '👤 درباره توسعه‌دهنده' }]
      ]
    }
  };
}

// تعریف کیبورد داخل‌پیامی (Inline) نمونه
function inlineKeyboardForStart() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'شروع', callback_data: 'start' }, { text: 'کمک', callback_data: 'help' }],
        [{ text: 'تنظیمات', callback_data: 'settings' }]
      ]
    }
  };
}

// روی /start پیام خوش‌آمدگویی ارسال می‌کنیم و دکمه‌ها فارسی هستند
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcome = `سلام ${msg.from.first_name || ''}!\nبه ربات خوش آمدید.\nبرای شروع روی دکمه‌ها کلیک کنید.`;
  bot.sendMessage(chatId, welcome, mainKeyboard());
});

// مدیریت پیام‌های متنی ساده (دکمه‌ها)
bot.on('message', async (msg) => {
  const text = msg.text || '';
  const chatId = msg.chat.id;

  // از فرمان‌های ساده فارسی پشتیبانی شده
  if (text === '📩 ارسال پیام') {
    // فقط ادمین می‌تواند پیام عمومی بفرستد — برای سادگی، چک می‌کنیم آیا کاربر همان id تنظیم‌شده است
    if (String(chatId) === String(DEFAULT_CHAT_ID) || String(msg.from.username) === String(DEVELOPER.telegram).replace('@','')) {
      bot.sendMessage(chatId, 'لطفاً متن پیام را وارد کنید (این پیام به آی‌دی تنظیم‌شده ارسال خواهد شد):');
      // حالت ساده: منتظر پیام بعدی نیستیم؛ برای پیاده‌سازی کامل باید stateful نگهداری کنیم.
      // برای همین در این نسخه راهنمایی می‌کنیم که از فرمان /send استفاده کند.
      bot.sendMessage(chatId, 'یا از فرمان زیر استفاده کن: /send پیام شما');
      return;
    } else {
      bot.sendMessage(chatId, 'شما اجازه ارسال عمومی را ندارید.');
      return;
    }
  }

  if (text === 'ℹ️ راهنما' || text === '/help') {
    const helpText = `راهنما:\n- از /start برای شروع استفاده کنید.\n- برای ارسال پیام به آی‌دی تنظیم‌شده، از فرمان زیر استفاده کنید:\n  /send متن پیام\n- برای دیدن اطلاعات توسعه‌دهنده از دکمه "👤 درباره توسعه‌دهنده" استفاده کنید.`;
    bot.sendMessage(chatId, helpText, mainKeyboard());
    return;
  }

  if (text === '⚙️ تنظیمات') {
    bot.sendMessage(chatId, `تنظیمات فعلی:\n- آی‌دی پیش‌فرض: ${DEFAULT_CHAT_ID}\n- هاست: ${HOST}`, mainKeyboard());
    return;
  }

  if (text === '👤 درباره توسعه‌دهنده') {
    bot.sendMessage(chatId, `توسعه‌دهنده: ${DEVELOPER.name}\nتلگرام: ${DEVELOPER.telegram}`, mainKeyboard());
    return;
  }
});

// فرمان امن برای ارسال پیام به آی‌دی مشخص‌شده در data.json
// استفاده: /send سلام دنیا
bot.onText(/\/send (.+)/, async (msg, match) => {
  const fromId = msg.from.id;
  const textToSend = match[1];

  // امنیت: اجازه فقط به توسعه‌دهنده یا صاحب آی‌دی داده شده
  const allowed = (String(fromId) === String(DEFAULT_CHAT_ID)) ||
                  (String(msg.from.username) === String(DEVELOPER.telegram).replace('@',''));

  if (!allowed) {
    bot.sendMessage(msg.chat.id, 'شما اجازه اجرای این فرمان را ندارید.');
    return;
  }

  if (!DEFAULT_CHAT_ID) {
    bot.sendMessage(msg.chat.id, 'هیچ آی‌دی مقصدی در data.json تنظیم نشده است. لطفاً data.json را تنظیم کنید.');
    return;
  }

  try {
    await bot.sendMessage(DEFAULT_CHAT_ID, textToSend);
    bot.sendMessage(msg.chat.id, 'پیام با موفقیت ارسال شد ✅');
  } catch (err) {
    console.error('خطا در ارسال پیام:', err);
    bot.sendMessage(msg.chat.id, 'خطا در ارسال پیام. در لاگ‌ها بررسی کنید.');
  }
});

// Callback queries (برای inline keyboard)
bot.on('callback_query', (callbackQuery) => {
  const action = callbackQuery.data;
  const msg = callbackQuery.message;

  if (action === 'start') {
    bot.sendMessage(msg.chat.id, 'شما دکمه شروع را زده‌اید.', mainKeyboard());
  } else if (action === 'help') {
    bot.sendMessage(msg.chat.id, 'راهنما: از /help یا دکمه‌های صفحه استفاده کنید.', mainKeyboard());
  } else if (action === 'settings') {
    bot.sendMessage(msg.chat.id, `تنظیمات: آی‌دی پیش‌فرض ${DEFAULT_CHAT_ID}`, mainKeyboard());
  }

  bot.answerCallbackQuery(callbackQuery.id);
});

// در صورتی که می‌خواهی پیام پیش‌فرض از data.json به آی‌دی تنظیم‌شده ارسال شود:
async function sendDefaultToConfiguredId() {
  if (!DEFAULT_CHAT_ID) return;
  try {
    await bot.sendMessage(DEFAULT_CHAT_ID, DEFAULT_TEXT);
    console.log('پیام پیش‌فرض ارسال شد.');
  } catch (err) {
    console.warn('ارسال پیام پیش‌فرض انجام نشد:', err.message || err);
  }
}

// به صورت اختیاری در بالا آمدن سرور، یک بار پیام پیش‌فرض را بفرست
sendDefaultToConfiguredId();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`سرور روی پورت ${PORT} اجرا شد. توسعه‌دهنده: ${DEVELOPER.name} (${DEVELOPER.telegram})`);
});
