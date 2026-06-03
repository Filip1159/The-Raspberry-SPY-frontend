module.exports = function (config) {
    config.set({
        frameworks: ["jasmine", "kjhtml"],
        plugins: [
            require("karma-jasmine"),
            require("karma-chrome-launcher"),
            require("karma-jasmine-html-reporter"),
            require("karma-coverage"),
        ],
        client: {
            clearContext: false,
        },
        browsers: ["Chrome"],
        customLaunchers: {
            ChromeHeadlessCI: {
                base: "Chrome",
                flags: [
                    "--headless",
                    "--disable-gpu",
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                ],
            },
        },
        reporters: ["progress", "kjhtml"],
        port: 9876,
        colors: true,
        logLevel: config.LOG_INFO,
        autoWatch: true,
        singleRun: false,
        restartOnFileChange: true,
    });
};
