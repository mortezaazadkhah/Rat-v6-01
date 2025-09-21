// server.js
// بازنویسی شده توسط: مستر آزاد (@metanoia_34)
// توضیحات: نسخه‌ای ساده، امن و فارسی‌سازی‌شده از سرور تلگرام/اکسپرس

// وارد کردن کتابخانه‌های مورد نیاز
const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');

// مسیر فایل داده‌ها (data.json)
const DATA_PATH = path.join(__dirname, 'data.json');

// بارگذاری پیکربندی (خواندن همزمان؛ در محیط production بهتر است از روش غیرهمزمان استفاده شود)
if (!fs.existsSync(DATA_PATH)) {
  console.error('فایل data.json پیدا نشد. لطفاً data.json را با مقادیر لازم پر کنید.');
  process.exit(1); // خروج از برنامه در صورت عدم وجود فایل
}

let raw = fs.readFileSync(DATA_PATH, 'utf8'); // خواندن محتوای فایل
let config;
try {
  config = JSON.parse(raw); // تجزیه JSON
} catch (err) {
  console.error('خطا در خواندن data.json:', err);
  process.exit(1); // خروج در صورت خطای تجزیه
}

// استخراج مقادیر از فایل پیکربندی یا استفاده از مقادیر پیش‌فرض
const TOKEN = config.token || ''; // توکن ربات تلگرام
const DEFAULT_CHAT_ID = config.id || ''; // چت‌آیدی پیش‌فرض برای ارسال پیام
const HOST = config.host || '/'; // آدرس میزبان
const DEFAULT_TEXT = config.text || 'سلام! این یک پیام نمونه است.'; // متن پیش‌فرض پیام
// اطلاعات توسعه‌دهنده (در صورت عدم وجود، از مقادیر پیش‌فرض استفاده می‌شود)
const DEVELOPER = (config.developer && config.developer.name) ? config.developer : { name: 'مستر آزاد', telegram: '@metanoia_34' };

// بررسی وجود توکن
if (!TOKEN) {
  console.error('توکن ربات در data.json تنظیم نشده است. لطفاً مقدار "token" را قرار دهید.');
  process.exit(1);
}

// ایجاد نمونه ربات تلگرام با استفاده از روش Polling (برای سادگی)
const bot = new TelegramBot(TOKEN, { polling: true });

// ایجاد برنامه اکسپرس
const app = express();
// استفاده از میان‌افزارهای تجزیه بدنه درخواست
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// مسیر اصلی برای بررسی وضعیت سرور
app.get('/', (req, res) => {
  res.send(`ربات بالا است — توسعه‌دهنده: ${DEVELOPER.name} (${DEVELOPER.telegram})`);
});

// تعریف کیبورد اصلی (دکمه‌های شیشه‌ای فارسی)
function mainKeyboard() {
  return {
    reply_markup: {
      resize_keyboard: true, // تغییر اندازه کیبورد
      keyboard: [ // آرایه‌ای از ردیف‌های دکمه
        [{ text: '📩 ارسال پیام' }, { text: 'ℹ️ راهنما' }],
        [{ text: '⚙️ تنظیمات' }, { text: '👤 درباره توسعه‌دهنده' }]
      ]
    }
  };
}

// تعریف کیبورد اینلاین (نمونه)
function inlineKeyboardForStart() {
  return {
    reply_markup: {
      inline_keyboard: [ // دکمه‌های اینلاین
        [{ text: 'شروع', callback_data: 'start' }, { text: 'کمک', callback_data: 'help' }],
        [{ text: 'تنظیمات', callback_data: 'settings' }]
      ]
    }
  };
}

// پردازش دستور /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcome = `سلام ${msg.from.first_name || ''}!\nبه ربات خوش آمدید.\nبرای شروع روی دکمه‌ها کلیک کنید.`;
  bot.sendMessage(chatId, welcome, mainKeyboard()); // ارسال پیام خوش‌آمدگویی با کیبورد
});

// پردازش تمام پیام‌های متنی
bot.on('message', async (msg) => {
  const text = msg.text || '';
  const chatId = msg.chat.id;

  // پردازش دکمه "ارسال پیام"
  if (text === '📩 ارسال پیام') {
    // بررسی مجوز کاربر (آیا ادمین است؟)
    if (String(chatId) === String(DEFAULT_CHAT_ID) || String(msg.from.username) === String(DEVELOPER.telegram).replace('@','')) {
      bot.sendMessage(chatId, 'لطفاً متن پیام را وارد کنید (این پیام به آی‌دی تنظیم‌شده ارسال خواهد شد):');
      bot.sendMessage(chatId, 'یا از فرمان زیر استفاده کن: /send پیام شما'); // راهنمای استفاده از فرمان
    } else {
      bot.sendMessage(chatId, 'شما اجازه ارسال عمومی را ندارید.');
    }
    return;
  }

  // پردازش دکمه "راهنما"
  if (text === 'ℹ️ راهنما' || text === '/help') {
    const helpText = `راهنما:\n- از /start برای شروع استفاده کنید.\n- برای ارسال پیام به آی‌دی تنظیم‌شده، از فرمان زیر استفاده کنید:\n  /send متن پیام\n- برای دیدن اطلاعات توسعه‌دهنده از دکمه "👤 درباره توسعه‌دهنده" استفاده کنید.`;
    bot.sendMessage(chatId, helpText, mainKeyboard());
    return;
  }

  // پردازش دکمه "تنظیمات"
  if (text === '⚙️ تنظیمات') {
    bot.sendMessage(chatId, `تنظیمات فعلی:\n- آی‌دی پیش‌فرض: ${DEFAULT_CHAT_ID}\n- هاست: ${HOST}`, mainKeyboard());
    return;
  }

  // پردازش دکمه "درباره توسعه‌دهنده"
  if (text === '👤 درباره توسعه‌دهنده') {
    bot.sendMessage(chatId, `توسعه‌دهنده: ${DEVELOPER.name}\nتلگرام: ${DEVELOPER.telegram}`, mainKeyboard());
    return;
  }
});

// پردازش فرمان /send برای ارسال پیام به چت‌آیدی مشخص
bot.onText(/\/send (.+)/, async (msg, match) => {
  const fromId = msg.from.id;
  const textToSend = match[1]; // متن پیام

  // بررسی مجوز کاربر (آیا ادمین یا توسعه‌دهنده است؟)
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
    await bot.sendMessage(DEFAULT_CHAT_ID, textToSend); // ارسال پیام به مقصد
    bot.sendMessage(msg.chat.id, 'پیام با موفقیت ارسال شد ✅');
  } catch (err) {
    console.error('خطا در ارسال پیام:', err);
    bot.sendMessage(msg.chat.id, 'خطا در ارسال پیام. در لاگ‌ها بررسی کنید.');
  }
});

// پردازش کلیک روی دکمه‌های اینلاین
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

  bot.answerCallbackQuery(callbackQuery.id); // پاسخ به کوئری
});

// تابع ارسال پیام پیش‌فرض به چت‌آیدی تنظیم‌شده
async function sendDefaultToConfiguredId() {
  if (!DEFAULT_CHAT_ID) return;
  try {
    await bot.sendMessage(DEFAULT_CHAT_ID, DEFAULT_TEXT);
    console.log('پیام پیش‌فرض ارسال شد.');
  } catch (err) {
    console.warn('ارسال پیام پیش‌فرض انجام نشد:', err.message || err);
  }
}

// ارسال پیام پیش‌فرض هنگام راه‌اندازی سرور
sendDefaultToConfiguredId();

// راه‌اندازی سرور اکسپرس روی پورت مشخص
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`سرور روی پورت ${PORT} اجرا شد. توسعه‌دهنده: ${DEVELOPER.name} (${DEVELOPER.telegram})`);
});
