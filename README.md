# 顔 in Video

Demo
https://novogrammer.github.io/kao-in-video/

## 動画の準備

MacBookのQuickTime Playerでムービー記録
720pで書き出す。（movで保存される）

```
$ ffmpeg -i ./movie.mov -pix_fmt yuv420p -an ./movie.mp4
```

##　トラッキングデータの記録

開発サーバーを立て、
http://localhost:8080/recorder/
へアクセス、mp4を読み込ませると2回再生され、*.bson.gzがダウンロードされる。


## 開発サーバー

```
$ npm run serve
```

## ビルド

```
$ npm run build
```
