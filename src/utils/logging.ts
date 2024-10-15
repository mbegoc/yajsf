import { settings } from "../config"
import { Dict } from "../types"


export const ERROR = 50
export const WARN = 40
export const LOG = 30
export const INFO = 20
export const DEBUG = 10


const themes: Dict = {
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
    protected inGroup = false
    protected section!: string
    protected labelStyle!: string
    protected textStyle!: string

    constructor(section: string, theme: string) {
        this.section = section
        this.loadTheme(theme)
    }

    loadTheme(theme: string) {
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

    writeLog(consoleCall: Function, level: number, args: any[]) {
        if (settings.logLevel <= level) {
            consoleCall(...args)
        }
    }

    writeRichLog(consoleCall: Function, level: number,
                 args: any[], firstArg: any = null) {
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

    error(...args: any[]) {
        this.writeRichLog(console.error, ERROR, args)
    }

    warn(...args: any[]) {
        this.writeRichLog(console.warn, WARN, args)
    }

    log(...args: any[]) {
        this.writeRichLog(console.log, LOG, args)
    }

    info(...args: any[]) {
        this.writeRichLog(console.info, INFO, args)
    }

    debug(...args: any[]) {
        this.writeRichLog(console.debug, DEBUG, args)
    }

    assert(...args: any[]) {
        this.writeLog(console.assert, DEBUG, args)
    }

    trace(...args: any[]) {
        this.writeRichLog(console.trace, DEBUG, args)
    }

    table(...args: any[]) {
        this.writeRichLog(console.table, DEBUG, args)
    }

    time(...args: any[]) {
        this.writeRichLog(console.time, DEBUG, args, args.shift())
    }

    timeEnd(...args: any[]) {
        this.writeRichLog(console.timeEnd, DEBUG, args, args.shift())
    }

    timeLog(...args: any[]) {
        this.writeRichLog(console.timeLog, DEBUG, args, args.shift())
    }

    count(...args: any[]) {
        this.writeLog(console.count, DEBUG, args)
    }

    countReset(...args: any[]) {
        this.writeRichLog(console.countReset, DEBUG, args, args.shift())
    }

    exception(...args: any[]) {
        // @ts-ignore
        this.writeLog(console.exception, DEBUG, args)
    }

    dir(...args: any[]) {
        this.writeLog(console.dir, DEBUG, args)
    }

    groupCollapsed(...args: any[]) {
        this.writeRichLog(console.groupCollapsed, DEBUG, args)
        this.inGroup = true
    }

    group(...args: any[]) {
        this.writeRichLog(console.group, DEBUG, args)
        this.inGroup = true
    }

    groupEnd(...args: any[]) {
        this.writeLog(console.groupEnd, DEBUG, args)
        this.inGroup = false
    }

}

export function getLogger(section: string, theme="Default"): Logger {
    return new Logger(section, theme)
}
