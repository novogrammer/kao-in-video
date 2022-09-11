// Generated using webpack-cli https://github.com/webpack/webpack-cli

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require("copy-webpack-plugin");
const {version_wasm}=require("@tensorflow/tfjs-backend-wasm");

const isProduction = process.env.NODE_ENV == 'production';


const stylesHandler = 'style-loader';



const config = {
    entry: {
        index:'./src/js/index.ts',
        recorder:'./src/js/recorder.ts',
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
    },
    devServer: {
        open: true,
        host: 'localhost',
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/index.html.ejs',
            templateParameters:{
                relRoot:"./",
            },
            filename: 'index.html',
            chunks:["index"],
        }),
        new HtmlWebpackPlugin({
            template: './src/recorder/index.html.ejs',
            templateParameters:{
                relRoot:"../",
            },
            filename: 'recorder/index.html',
            chunks:["recorder"],
        }),
        new CopyPlugin({
            patterns:[
                {
                    from:"node_modules/@tensorflow/tfjs-backend-webgl/dist",
                    to:`lib/@tensorflow/tfjs-backend-wasm@${version_wasm}/dist/`,
                },
                {
                    from:"node_modules/@mediapipe/face_mesh",
                    to:`lib/@mediapipe/face_mesh`,
                },
                {
                    from:"src/movie",
                    to:`movie`,
                },
            ]
        }),

        // Add your plugins here
        // Learn more about plugins from https://webpack.js.org/configuration/plugins/
    ],
    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/i,
                loader: 'ts-loader',
                exclude: ['/node_modules/'],
            },
            {
                test: /\.css$/i,
                use: [stylesHandler,'css-loader'],
            },
            {
                test: /\.s[ac]ss$/i,
                use: [stylesHandler, 'css-loader', 'sass-loader'],
            },
            {
                test: /\.(eot|svg|ttf|woff|woff2|png|jpg|gif)$/i,
                type: 'asset',
            },

            // Add your rules for custom modules here
            // Learn more about loaders from https://webpack.js.org/loaders/
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.jsx', '.js', '...'],
    },
};

module.exports = () => {
    if (isProduction) {
        config.mode = 'production';
        
        
    } else {
        config.mode = 'development';
    }
    return config;
};
