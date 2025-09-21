// server.js
// بازنویسی و اصلاح‌شده — دکمه‌ها بازگردانده و فارسی‌سازی شدند
// نوشته شده توسط: مستر آزاد (@metanoia_34)

const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');

const DATA_PATH = path.join(__dirname, 'data.json');

// بارگذاری تنظیمات
if (!fs.existsSync(DATA_PATH)) {
  console.error('فایل data.json پیدا نشد. لطفاً data.json را با مقادیر لازم پر کنید.');
  process.exit(1);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
} catch (err) {
  console.error('خطا در خواندن data.json:', err);
  process.exit(1);
}

const TOKEN = (config.token || '').trim();
const DEFAULT_CHAT_ID = config.id || '';
const HOST = config.host || '';
const DEFAULT_TEXT = config.text || 'سلام! این پیام پیش‌فرض است.';
const DEVELOPER = (config.developer && config.developer.name) ? config.developer : { name: 'مستر آزاد', telegram: '@metanoia_34' };
const DEV_USERNAME = (config.developer && config.developer.telegram) ? config.developer.telegram.replace('@','') : 'metanoia_34';

if (!TOKEN) {
  console.error('توکن ربات در data.json تنظیم نشده است. لطفاً مقدار "token" را قرار دهید.');
  process.exit(1);
}

// شروع ربات (polling برای سادگی)
const bot = new TelegramBot(TOKEN, { polling: true });

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// وضعیت‌های ساده برای نگهداری احضارهای مرحله‌ای (در حافظه)
const awaiting = new Map();
// ساختار awaiting.get(chatId) = { action: 'send_direct' | 'broadcast' | 'ask_group_id' | 'ask_group_message' | 'update_setting', data: {...} }

// کیبورد‌ها (فارسی)
function mainKeyboard() {
  return {
    reply_markup: {
      resize_keyboard: true,
      keyboard: [
        [{ text: '📩 ارسال پیام' }, { text: '📤 ارسال به گروه' }],
        [{ text: 'ℹ️ راهنما' }, { text: '👤 درباره توسعه‌دهنده' }],
        [{ text: '⚙️ تنظیمات' }, { text: '🔒 پنل مدیریت' }],
        [{ text: '🔙 بازگشت' }]
      ]
    }
  };
}

function adminKeyboard() {
  return {
    reply_markup: {
      resize_keyboard: true,
      keyboard: [
        [{ text: '📢 پخش همگانی' }, { text: '📨 ارسال پیام پیش‌فرض' }],
        [{ text: '📂 مدیریت فایل‌ها' }, { text: '📊 گزارشات' }],
        [{ text: '🔙 بازگشت' }]
      ]
    }
  };
}

function settingsKeyboard() {
  return {
    reply_markup: {
      resize_keyboard: true,
      keyboard: [
        [{ text: '✏️ تغییر آی‌دی مقصد' }, { text: '✏️ تغییر پیام پیش‌فرض' }],
        [{ text: '✏️ تغییر هاست' }, { text: '🔙 بازگشت' }]
      ]
    }
  };
}

function inlineKeyboardForStart() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'شروع', callback_data: 'start' }, { text: 'کمک', callback_data: 'help' }],
        [{ text: 'تنظیمات', callback_data: 'settings' }, { text: 'درباره توسعه‌دهنده', callback_data: 'developer' }]
      ]
    }
  };
}

function confirmInline(actionId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'تأیید ✅', callback_data: `confirm:${actionId}` }, { text: 'لغو ❌', callback_data: `cancel:${actionId}` }]
      ]
    }
  };
}

// مسیر سلامتی سرور
app.get('/', (req, res) => {
  res.send(`ربات فعال است — توسعه‌دهنده: ${DEVELOPER.name} (${DEVELOPER.telegram})`);
});

// تابع بررسی ادمین
function isAdmin(user) {
  if (!user) return false;
  if (String(user.id) === String(DEFAULT_CHAT_ID)) return true;
  if (user.username && user.username.toLowerCase() === DEV_USERNAME.toLowerCase()) return true;
  return false;
}

// فرمان /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || '';
  const welcome = `سلام ${name}!\nبه ربات خوش آمدید. از منو یا دکمه‌های زیر استفاده کنید.`;
  bot.sendMessage(chatId, welcome, { ...mainKeyboard(), ...inlineKeyboardForStart() });
});

// فرمان /help (یا متن راهنما)
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpText = `راهنما:\n- از دکمه‌ها برای عملیات سریع استفاده کنید.\n- ارسال پیام به آی‌دی مقصد: /send متن پیام\n- ادمین‌ها می‌توانند از پنل مدیریت استفاده کنند.`;
  bot.sendMessage(chatId, helpText, mainKeyboard());
});

// فرمان /send (امن): /send متن پیام
bot.onText(/\/send (.+)/, async (msg, match) => {
  const from = msg.from;
  const textToSend = match[1];
  if (!isAdmin(from)) {
    bot.sendMessage(msg.chat.id, 'شما اجازه اجرای این فرمان را ندارید.', mainKeyboard());
    return;
  }
  if (!DEFAULT_CHAT_ID) {
    bot.sendMessage(msg.chat.id, 'آی‌دی مقصد در data.json تنظیم نشده است.');
    return;
  }
  try {
    await bot.sendMessage(DEFAULT_CHAT_ID, textToSend);
    bot.sendMessage(msg.chat.id, 'پیام با موفقیت ارسال شد ✅', mainKeyboard());
  } catch (err) {
    console.error('خطا در ارسال /send:', err);
    bot.sendMessage(msg.chat.id, 'خطا در ارسال پیام. لاگ سرور را بررسی کنید.');
  }
});

// مدیریت پیام‌های دریافتی (دکمه‌های ریپلای کیبورد هم به صورت متن دریافت می‌شوند)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const from = msg.from;
  const text = (msg.text || '').trim();

  // اگر پیام یک فرمان (slash) باشد که در handlers جدا مدیریت می‌شود، از این‌جا عبور کن.
  if (text.startsWith('/')) return;

  // بررسی حالت انتظار (اگر کاربر در حالت وارد کردن متن برای عملیاتی خاص است)
  if (awaiting.has(chatId)) {
    const state = awaiting.get(chatId);

    // ارسال مستقیم به آی‌دی مقصد
    if (state.action === 'send_direct') {
      try {
        if (!DEFAULT_CHAT_ID) {
          bot.sendMessage(chatId, 'آی‌دی مقصد تنظیم نشده است. ابتدا data.json را ویرایش کنید.');
        } else {
          await bot.sendMessage(DEFAULT_CHAT_ID, text);
          bot.sendMessage(chatId, 'پیام ارسال شد ✅', mainKeyboard());
        }
      } catch (err) {
        console.error('خطا در ارسال مستقیم:', err);
        bot.sendMessage(chatId, 'خطا در ارسال پیام.');
      }
      awaiting.delete(chatId);
      return;
    }

    // ارسال به گروه مشخص‌شده (گروه آیدی قبلا پرسیده شده)
    if (state.action === 'ask_group_message') {
      const targetGroupId = state.data && state.data.groupId;
      if (!targetGroupId) {
        bot.sendMessage(chatId, 'شناسه گروه یافت نشد. دوباره اقدام کنید.', mainKeyboard());
        awaiting.delete(chatId);
        return;
      }
      try {
        await bot.sendMessage(targetGroupId, text);
        bot.sendMessage(chatId, `پیام به گروه ${targetGroupId} ارسال شد ✅`, mainKeyboard());
      } catch (err) {
        console.error('خطا در ارسال به گروه:', err);
        bot.sendMessage(chatId, 'خطا در ارسال به گروه. ممکن است ربات وارد گروه نشده باشد یا آی‌دی اشتباه باشد.');
      }
      awaiting.delete(chatId);
      return;
    }

    // پخش همگانی: پس از نوشتن متن، از کاربر تایید می‌گیرد
    if (state.action === 'broadcast_confirm') {
      // این حالت معمولاً با callback inline ادامه پیدا می‌کند؛ اما اگر کاربر متن گذاشت مستقیم آن را برای لیست مقصد ذخیره می‌کنیم و یک دکمه تأیید نشان می‌دهیم
      state.data = state.data || {};
      state.data.message = text;
      awaiting.set(chatId, state);
      bot.sendMessage(chatId, 'آیا می‌خواهید این پیام را پخش همگانی کنید؟', confirmInline('broadcast'));
      return;
    }

    // تنظیمات: تغییر آی‌دی مقصد
    if (state.action === 'update_default_id') {
      // فقط ادمین می‌تواند
      if (!isAdmin(from)) {
        bot.sendMessage(chatId, 'شما اجازه تغییر تنظیمات را ندارید.', mainKeyboard());
        awaiting.delete(chatId);
        return;
      }
      const newId = text;
      config.id = newId;
      try {
        fs.writeFileSync(DATA_PATH, JSON.stringify(config, null, 2), 'utf8');
        bot.sendMessage(chatId, `آی‌دی مقصد با موفقیت به "${newId}" تغییر کرد.`, mainKeyboard());
      } catch (err) {
        console.error('خطا در نوشتن data.json:', err);
        bot.sendMessage(chatId, 'خطا در ذخیره تنظیمات روی سرور.');
      }
      awaiting.delete(chatId);
      return;
    }

    // تغییر پیام پیش‌فرض
    if (state.action === 'update_default_text') {
      if (!isAdmin(from)) {
        bot.sendMessage(chatId, 'شما اجازه تغییر تنظیمات را ندارید.', mainKeyboard());
        awaiting.delete(chatId);
        return;
      }
      config.text = text;
      try {
        fs.writeFileSync(DATA_PATH, JSON.stringify(config, null, 2), 'utf8');
        bot.sendMessage(chatId, 'پیام پیش‌فرض با موفقیت به‌روز شد.', mainKeyboard());
      } catch (err) {
        console.error('خطا در نوشتن data.json:', err);
        bot.sendMessage(chatId, 'خطا در ذخیره تنظیمات.');
      }
      awaiting.delete(chatId);
      return;
    }

    // اگر به هر دلیلی نیافتیم، حذف حالت
    awaiting.delete(chatId);
  }

  // اگر پیام از نوع یکی از دکمه‌ها باشد، هندل کن
  switch (text) {
    case '📩 ارسال پیام':
      if (!isAdmin(from)) {
        bot.sendMessage(chatId, 'فقط ادمین می‌تواند پیام ارسال کند.', mainKeyboard());
        return;
      }
      awaiting.set(chatId, { action: 'send_direct', data: {} });
      bot.sendMessage(chatId, 'لطفاً متن پیام را وارد کنید. این پیام به آی‌دی مقصد ارسال خواهد شد.', { reply_markup: { remove_keyboard: true } });
      return;

    case '📤 ارسال به گروه':
      if (!isAdmin(from)) {
        bot.sendMessage(chatId, 'فقط ادمین می‌تواند پیام به گروه ارسال کند.', mainKeyboard());
        return;
      }
      awaiting.set(chatId, { action: 'ask_group_id', data: {} });
      bot.sendMessage(chatId, 'لطفاً آیدی گروه یا چت (مثلاً -1001234567890) را وارد کنید:');
      return;

    case 'ℹ️ راهنما':
      bot.sendMessage(chatId, `راهنما:\n- برای ارسال پیام عمومی از '📩 ارسال پیام' استفاده کنید.\n- برای ارسال به گروه از '📤 ارسال به گروه' استفاده کنید.\n- مدیران می‌توانند از '🔒 پنل مدیریت' استفاده کنند.`, mainKeyboard());
      return;

    case '👤 درباره توسعه‌دهنده':
      bot.sendMessage(chatId, `توسعه‌دهنده: ${DEVELOPER.name}\nتلگرام: ${DEVELOPER.telegram}`, mainKeyboard());
      return;

    case '⚙️ تنظیمات':
      bot.sendMessage(chatId, 'منوی تنظیمات:', settingsKeyboard());
      return;

    case '🔒 پنل مدیریت':
      if (!isAdmin(from)) {
        bot.sendMessage(chatId, 'شما دسترسی به پنل مدیریت ندارید.', mainKeyboard());
        return;
      }
      bot.sendMessage(chatId, 'پنل مدیریت:', adminKeyboard());
      return;

    case '📢 پخش همگانی':
      if (!isAdmin(from)) {
        bot.sendMessage(chatId, 'شما اجازه انجام این عملیات را ندارید.', mainKeyboard());
        return;
      }
      awaiting.set(chatId, { action: 'broadcast_confirm', data: {} });
      bot.sendMessage(chatId, 'لطفاً متن پیام برای پخش همگانی را وارد کنید: (پس از وارد کردن متن، از شما تأیید خواسته می‌شود)');
      return;

    case '📨 ارسال پیام پیش‌فرض':
      if (!isAdmin(from)) {
        bot.sendMessage(chatId, 'شما اجازه انجام این عملیات را ندارید.', mainKeyboard());
        return;
      }
      try {
        if (!DEFAULT_CHAT_ID) {
          bot.sendMessage(chatId, 'آی‌دی مقصد تنظیم نشده است. لطفاً ابتدا تنظیمات را اصلاح کنید.', mainKeyboard());
          return;
        }
        await bot.sendMessage(DEFAULT_CHAT_ID, DEFAULT_TEXT);
        bot.sendMessage(chatId, 'پیام پیش‌فرض ارسال شد ✅', mainKeyboard());
      } catch (err) {
        console.error('خطا در ارسال پیام پیش‌فرض:', err);
        bot.sendMessage(chatId, 'خطا در ارسال پیام پیش‌فرض.');
      }
      return;

    case '📂 مدیریت فایل‌ها':
      bot.sendMessage(chatId, 'قابلیت مدیریت فایل‌ها هنوز فعال نشده است. (می‌توانم اضافه کنم)', mainKeyboard());
      return;

    case '📊 گزارشات':
      bot.sendMessage(chatId, 'قابلیت گزارش‌گیری هنوز فعال نشده است. (می‌توانم اضافه کنم)', mainKeyboard());
      return;

    case '✏️ تغییر آی‌دی مقصد':
      if (!isAdmin(from)) {
        bot.sendMessage(chatId, 'شما اجازه تغییر تنظیمات را ندارید.', mainKeyboard());
        return;
      }
      awaiting.set(chatId, { action: 'update_default_id', data: {} });
      bot.sendMessage(chatId, 'لطفاً آی‌دی جدید مقصد را وارد کنید:');
      return;

    case '✏️ تغییر پیام پیش‌فرض':
      if (!isAdmin(from)) {
        bot.sendMessage(chatId, 'شما اجازه تغییر تنظیمات را ندارید.', mainKeyboard());
        return;
      }
      awaiting.set(chatId, { action: 'update_default_text', data: {} });
      bot.sendMessage(chatId, 'لطفاً متن جدید پیام پیش‌فرض را وارد کنید:');
      return;

    case '✏️ تغییر هاست':
      if (!isAdmin(from)) {
        bot.sendMessage(chatId, 'شما اجازه تغییر تنظیمات را ندارید.', mainKeyboard());
        return;
      }
      awaiting.set(chatId, { action: 'update_host', data: {} });
      bot.sendMessage(chatId, 'برای تغییر هاست، لطفاً در فایل data.json مقدار host را تغییر دهید. (می‌خواهید من این قابلیت ویرایش از طریق ربات را اضافه کنم؟)');
      return;

    case '🔙 بازگشت':
      bot.sendMessage(chatId, 'بازگشت به منوی اصلی.', mainKeyboard());
      return;

    default:
      // پیام معمولی و نه در حالت انتظار و نه یک دکمه شناخته‌شده
      // کاری انجام نده یا پیام راهنما نمایش بده
      // (از ارسال خودکار یا اسپم جلوگیری شده است)
      return;
  }
});

// مدیریت callback query ها (inline buttons)
bot.on('callback_query', async (callbackQuery) => {
  const data = callbackQuery.data || '';
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;

  // توکن action:ex
  if (data === 'start') {
    bot.sendMessage(chatId, 'شما دکمهٔ شروع را فشردید. از منوی اصلی استفاده کنید.', mainKeyboard());
    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }

  if (data === 'help') {
    bot.sendMessage(chatId, 'راهنما: از /help یا منو استفاده کنید.', mainKeyboard());
    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }

  if (data === 'settings') {
    bot.sendMessage(chatId, 'منوی تنظیمات:', settingsKeyboard());
    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }

  if (data === 'developer') {
    bot.sendMessage(chatId, `توسعه‌دهنده: ${DEVELOPER.name}\nتلگرام: ${DEVELOPER.telegram}`, mainKeyboard());
    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }

  // تایید یا لغو عملیات
  if (data.startsWith('confirm:')) {
    const actionId = data.split(':')[1];
    if (actionId === 'broadcast') {
      // بازیابی حالت و پیام
      const state = awaiting.get(chatId);
      if (!state || !state.data || !state.data.message) {
        bot.sendMessage(chatId, 'متنی برای پخش پیدا نشد. ابتدا متن را وارد کنید.', mainKeyboard());
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'عملیات ناموفق' });
        return;
      }
      const messageToSend = state.data.message;

      // امکان پخش به آرایه broadcast_list در data.json (اختیاری)
      const targetList = Array.isArray(config.broadcast_list) && config.broadcast_list.length ? config.broadcast_list : (DEFAULT_CHAT_ID ? [DEFAULT_CHAT_ID] : []);

      if (!targetList.length) {
        bot.sendMessage(chatId, 'هیچ مقصدی برای پخش پیدا نشد. لطفاً data.json را بررسی کنید یا آی‌دی مقصد را تنظیم کنید.', mainKeyboard());
        awaiting.delete(chatId);
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'هیچ مقصدی' });
        return;
      }

      // ارسال به هر مقصد (به صورت متوالی؛ توجه: مراقب محدودیت API باشید)
      let success = 0, fail = 0;
      for (const tid of targetList) {
        try {
          await bot.sendMessage(tid, messageToSend);
          success++;
        } catch (err) {
          console.warn('خطا در ارسال به', tid, err && err.message ? err.message : err);
          fail++;
        }
      }

      bot.sendMessage(chatId, `پخش انجام شد. موفق: ${success} — ناموفق: ${fail}`, mainKeyboard());
      awaiting.delete(chatId);
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'پخش انجام شد' });
      return;
    }
  }

  if (data.startsWith('cancel:')) {
    const actionId = data.split(':')[1];
    awaiting.delete(chatId);
    bot.sendMessage(chatId, 'عملیات لغو شد.', mainKeyboard());
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'لغو شد' });
    return;
  }

  // اگر callback نامشخص بود
  await bot.answerCallbackQuery(callbackQuery.id);
});

// وقتی کاربر آیدی گروه را وارد کرد (حالت ask_group_id)
bot.onText(/.*/, (msg) => {
  // این هندل به عنوان پشتیبان است؛ اما منطق اصلی در بخش message قرار دارد.
  // بنابراین اینجا نیازی به کاری نیست.
});

// (اختیاری) ارسال پیام پیش‌فرض هنگام راه‌اندازی (یک‌بار)
async function sendDefaultOnStart() {
  if (!DEFAULT_CHAT_ID || !DEFAULT_TEXT) return;
  try {
    await bot.sendMessage(DEFAULT_CHAT_ID, DEFAULT_TEXT);
    console.log('پیام پیش‌فرض ارسال شد.');
  } catch (err) {
    console.warn('ارسال پیام پیش‌فرض انجام نشد:', err && err.message ? err.message : err);
  }
}
sendDefaultOnStart();

// راه‌اندازی وب‌سرور
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`سرور روی پورت ${PORT} اجرا شد. توسعه‌دهنده: ${DEVELOPER.name} (${DEVELOPER.telegram})`);
});
