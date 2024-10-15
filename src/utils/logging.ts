import { settings } from "../config"


export const ERROR = 50
export const WARN = 40
export const LOG = 30
export const INFO = 20
export const DEBUG = 10


const themes = {
    "Default": {bgColor: "gray", color: "black", icon: "⚙"},
    "Blue": {bgColor: "darkblue", color: "lightgrey", icon: "⚘"},
    "Orange": {bgColor: "darkorange", color: "black", icon: "⚘"},
    "Yellow": {bgColor: "gold", color: "black", icon: "⚘"},
    "Red": {bgColor: "darkred", color: "ivory", icon: "⚘"},
    "Pink": {bgColor: "deeppink", color: "black", icon: "⚘"},
    "Aqua": {bgColor: "aqua", color: "black", icon: "⚗"},
    "Darkcyan": {bgColor: "darkcyan", color: "lightgrey", icon: "⚗"},
    "Green": {bgColor: "darkgreen", color: "lightgrey", icon: "⚘"},
    "Orchid": {bgColor: "darkorchid", color: "lightgrey", icon: "⚘"},
    "Indigo": {bgColor: "indigo", color: "lightgrey", icon: "⚘"},
    "Steel": {bgColor: "steelblue", color: "lightgrey", icon: "⚘"},
    ...settings.loggerThemes,
}


class Logger {

    constructor(section, theme) {
        this.section = section
        this.loadTheme(theme)
    }

    loadTheme(theme) {
        if (! themes[theme]) {
            this.warn(`YAJSF ― Logging: cannot find theme “${theme}”. `
                      + "Fallback to default.")
            theme = "Default"
        }
        let {bgColor, color, icon} = themes[theme]
        this.labelStyle = `display: inline-block; width: 120px; background-color: ${bgColor}; color: ${color}; padding: .6rem; border-radius: .6rem; font-size: 1.1rem; font-variant: Robotto small-caps; font-weight: bold; font-variant-emoji: emoji;`
        this.textStyle = `color: ${bgColor}; padding-left: 1em;`
        this.section = [icon, this.section].join(" ")
    }

    writeLog(consoleCall, level, args) {
        if (settings.logLevel <= level) {
            consoleCall(...args)
        }
    }

    writeRichLog(consoleCall, level, args, firstArg=null) {
        if (settings.logLevel <= level) {
            let pattern = ""
            let richArgs = []
            if (! this.inGroup) {
                pattern += "%c%s"
                richArgs.push(this.labelStyle)
                richArgs.push(this.section)
            }
            for (let arg of args) {
                if (["number", "string"].includes(typeof arg)) {
                    pattern += "%c%s"
                    richArgs.push(this.textStyle)
                    richArgs.push(arg)
                } else {
                    pattern += "%o"
                    richArgs.push(arg)
                }
            }
            richArgs.unshift(pattern)
            if (firstArg) {
                richArgs.unshift(firstArg)
            }
            consoleCall(...richArgs)
        }
    }

    error(...args) {
        this.writeRichLog(console.error, ERROR, args)
    }

    warn(...args) {
        this.writeRichLog(console.warn, WARN, args)
    }

    log(...args) {
        this.writeRichLog(console.log, LOG, args)
    }

    info(...args) {
        this.writeRichLog(console.info, INFO, args)
    }

    debug(...args) {
        this.writeRichLog(console.debug, DEBUG, args)
    }

    assert(...args) {
        this.writeLog(console.assert, DEBUG, args, args.shift())
    }

    trace(...args) {
        this.writeRichLog(console.trace, DEBUG, args)
    }

    table(...args) {
        this.writeRichLog(console.table, DEBUG, args)
    }

    time(...args) {
        this.writeRichLog(console.time, DEBUG, args, args.shift())
    }

    timeEnd(...args) {
        this.writeRichLog(console.timeEnd, DEBUG, args, args.shift())
    }

    timeLog(...args) {
        this.writeRichLog(console.timeLog, DEBUG, args, args.shift())
    }

    profile(...args) {
        this.writeLog(console.profile, DEBUG, args)
    }

    profileEnd(...args) {
        this.writeLog(console.profileEnd, DEBUG, args)
    }

    count(...args) {
        this.writeLog(console.count, DEBUG, args, args.shift())
    }

    countReset(...args) {
        this.writeRichLog(console.countReset, DEBUG, args, args.shift())
    }

    exception(...args) {
        this.writeLog(console.exception, DEBUG, args)
    }

    dir(...args) {
        this.writeLog(console.dir, DEBUG, args)
    }

    groupCollapsed(...args) {
        this.writeRichLog(console.groupCollapsed, DEBUG, args)
        this.inGroup = true
    }

    group(...args) {
        this.writeRichLog(console.group, DEBUG, args)
        this.inGroup = true
    }

    groupEnd(...args) {
        this.writeLog(console.groupEnd, DEBUG, args)
        this.inGroup = false
    }

}

export function getLogger(section, theme="Default") {
    return new Logger(section, theme)
}
