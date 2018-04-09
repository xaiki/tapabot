const auth = require('../auth');
const TelegramBot = require('node-telegram-bot-api');
const chokidar = require('chokidar');
const moment = require('moment');
const debug = require('debug')('tapa-bot')

const {IMG_BASE_URL} = require('./config')
const watcher = chokidar.watch('./zones.json', {
    persistent: true
});

// replace the value below with the Telegram token you receive from @BotFather
const token = auth.API_KEY;

let zones = require('./zones')

watcher.on('change', path => {
    debug('reloading data', path)
    zones = require('./zones')
})

function usage() {
    return `
/get Zone/Country[/newspaper]
/zones
/countries Zone
/newspapers Zone/Country
`
}

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true});

function getZones(msg) {
    const chatId = msg.chat.id;
    let user = msg.from.first_name

    bot.sendMessage(chatId, `Ok ${user}, choose a zone`, {
        "reply_markup": {
            "inline_keyboard": Object.keys(zones).map(z => ([
                {
                    text: z,
                    callback_data: `countries ${z}`
                }
            ]))
        }
    });
}

function getCountries(msg, match) {
    let zone = match[1]

    const chatId = msg.chat.id;
    let user = msg.from.first_name
    let res = zones[zone].countries

    bot.sendMessage(chatId, `Ok ${user}, choose a country`, {
        "reply_markup": {
            "inline_keyboard": Object.keys(res).map(c => ([
                {
                    text: `${zone}/${c}`,
                    callback_data: `get ${zone}/${c}`
                }
            ]))
        }
    });
}

function start(msg) {
    getZones(msg)
}

function sendNewsPapers(chatId, country, newspapers)  {
    let entries = Object.entries(newspapers)
    debug("newspapers: ", newspapers)
    let i = 0
    do {
        debug('entries', entries)
        bot.sendMediaGroup(chatId, entries.splice(i, i+10).map((e) => {
            let [k, v] = e

            return {
                type: 'photo',
                media: v.high,
                caption: `${country}: ${k}`
            }
        }))
        i +=10
    } while (i < entries.length);
}

function get10Days(newspaper, cover) {
    let [_, y, m, d, highUrl] =
        cover.high.match(new RegExp(`${IMG_BASE_URL}/([0-9]+)/([0-9]+)/([0-9]+)/(.*)`))

    let ret = {}
    let nm = moment(`${y}${m}${d}`)

    for (let i = 0; i < 10; i += 1) {
        let dt = nm.format('YYYY/MM/DD')
        ret[`${newspaper} (${dt})`] = {high: `${IMG_BASE_URL}/${dt}/${highUrl}`}
        nm.subtract(1, 'days')
    }

    return ret
}

function getCovers(msg, match) {
    let [zone, country, newspaper] = match[1].split('/')
    let userName = msg.from.first_name

    const chatId = msg.chat.id;

    if (! zone) {
        bot.sendMessage(chatId, `hey ${userName}, i need a zone baby`)
        return bot.sendMessage(chatId, usage())
    }

    if (! country) {
        bot.sendMessage(chatId,  `hey ${userName}, i need a zone baby`)
        return bot.sendMessage(chatId, usage())
    }

    if (! zones[zone]) {
        bot.sendMessage(chatId, 'wrong zone, try again')
        return bot.sendMessage(chatId, usage())
    }

    let countries = zones[zone].countries

    if (! country || ! countries[country]) {
        bot.sendMessage(chatId, 'wrong country, try again')
        return bot.sendMessage(chatId, usage())
    }

    setTimeout(() => start(msg), 2000)

    let newspapers = newspaper && countries[country].newspapers[newspaper]
                   ? get10Days(newspaper, countries[country].newspapers[newspaper])
                   : countries[country].newspapers

    return sendNewsPapers(chatId, country, newspapers)
}


const handlers = {
    'zones': getZones,
    'countries': getCountries,
    'start': start,
    'get': getCovers
}

Object.keys(handlers).forEach(k => {
    debug('instaling handler for:', k)
    bot.onText(new RegExp(`\/${k} ?(.*)`), handlers[k])
})

bot.on('callback_query', (cbq) => {
    const [action, args] = cbq.data.split(' ');
    const msg = cbq.message;
    const opts = {
        chat_id: msg.chat.id,
        message_id: msg.message_id
    };

    handlers[action](msg, [null, args])
    bot.editMessageText(`${action} → ${args}`, opts);
})

