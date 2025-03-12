export class LazyError extends Error {
    public message: string;

    public constructor(message: string) {
        super(message);
        this.message = "[LazyCanvas] [ERROR] " + message;
    }
}

export class LazyLog {
    public static log(type: string = "none", ...message: any): void {
        switch (type) {
            case "info":
                console.log("[LazyCanvas] [INFO] ", ...message);
                break;
            case "warn":
                console.warn("[LazyCanvas] [WARN] ", ...message);
                break;
            default:
                console.log(...message);
                break;
        }
    }
}

export const defaultArg = {
    wh(w?: number, h?: number): { width: number, height: number } {
        return { width: w || 0, height: h || 0 };
    },
    vl(vertical?: boolean, layer?: boolean): { vertical: boolean, layer: boolean } {
        return { vertical: vertical || false, layer: layer || false };
    }
}