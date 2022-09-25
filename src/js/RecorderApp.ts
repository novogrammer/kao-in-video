import { serialize } from 'bson';
import * as pako from "pako";
import "@tensorflow/tfjs-backend-webgl";

import { setWasmPaths, version_wasm } from "@tensorflow/tfjs-backend-wasm";

import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";


import * as faceMesh from "@mediapipe/face_mesh";
import { downloadBinary } from './download_utils';
// setWasmPaths(
//   `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@${version_wasm}/dist/`
// );
setWasmPaths(`/assets/lib/@tensorflow/tfjs-backend-wasm@${version_wasm}/dist/`);

console.log(`version_wasm: ${version_wasm}`);

console.log(`faceMesh.VERSION: ${faceMesh.VERSION}`);

console.log(`faceLandmarksDetection:`, faceLandmarksDetection);

const RECORDER_PLAYBACK_RATE=0.5;

export default class RecorderApp {
  canvas: HTMLCanvasElement;

  context2d: CanvasRenderingContext2D;

  file: HTMLInputElement;

  video: HTMLVideoElement;

  bindMap: {
    [key: string]: Function;
  };

  setupPromise: Promise<void>;

  detector: faceLandmarksDetection.FaceLandmarksDetector | null;

  facesList: faceLandmarksDetection.Face[][];

  endedCount: number;

  constructor() {
    this.canvas = document.querySelector(
      ".p-recorder-app__canvas"
    ) as HTMLCanvasElement;
    this.context2d = this.canvas.getContext("2d") as CanvasRenderingContext2D;
    this.file = document.querySelector(".p-recorder-app__file") as HTMLInputElement;
    this.video = document.createElement("video");
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.autoplay = true;

    this.bindMap = {};
    this.detector = null;
    this.facesList = [];
    this.endedCount=0;
    this.setupPromise = this.setupAsync();
  }

  async setupAsync() {
    await this.setupDetectorAsync();
    this.setupEvents();
  }

  getBind(methodName: string): Function {
    let bind = this.bindMap[methodName];
    if (!bind) {
      const thisAny = this as { [key: string]: any };
      bind = (thisAny[methodName] as Function).bind(this);
      this.bindMap[methodName] = bind;
    }
    return bind;
  }

  async setupDetectorAsync() {
    const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;

    try {

      const detector = await faceLandmarksDetection.createDetector(model, {
        runtime: "mediapipe",
        // solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
        solutionPath: '/lib/@mediapipe/face_mesh',
        refineLandmarks: true,
      });

      this.detector = detector;
    } catch (error) {
      this.detector = null;
      console.error(error);
    }

  }

  setupEvents() {
    this.file.addEventListener("change", this.getBind("onFileChange") as any);

    this.video.addEventListener("ended",this.getBind("onEnded") as any);
  }

  drawFace(face: faceLandmarksDetection.Face) {
    this.context2d.save();
    this.context2d.strokeStyle = "#f00";
    this.context2d.strokeRect(face.box.xMin, face.box.yMin, face.box.width, face.box.height);
    this.context2d.strokeStyle = "#f0f";
    this.context2d.beginPath();
    // eslint-disable-next-line no-restricted-syntax
    for (const [fromIndex, toIndex] of faceMesh.FACEMESH_TESSELATION) {
      const from = face.keypoints[fromIndex];
      const to = face.keypoints[toIndex];
      this.context2d.moveTo(from.x, from.y);
      this.context2d.lineTo(to.x, to.y);
    }
    this.context2d.stroke();



    this.context2d.restore();
  }

  async onRequestVideoFrame(now: DOMHighResTimeStamp, metadata: VideoFrameMetadata) {
    this.video.requestVideoFrameCallback(
      this.getBind("onRequestVideoFrame") as VideoFrameRequestCallback
    );
    this.canvas.width = metadata.width;
    this.canvas.height = metadata.height;
    this.context2d.drawImage(this.video, 0, 0);
    if (!this.detector) {
      throw new Error("detector is null");
    }

    try {
      const faces = await this.detector.estimateFaces(this.video, {
        flipHorizontal: false,
      });
      for (const face of faces) {
        this.drawFace(face);
      }
      if(this.endedCount==1){
        this.facesList.push(faces);
      }

    } catch (error) {
      this.detector.dispose();
      this.detector = null;
      console.error(error);
    }

  }

  onFileChange(event: InputEvent) {
    this.setupPromise.then(() => {
      if(!("requestVideoFrameCallback" in this.video)){
        throw new Error("no requestVideoFrameCallback");
      }
      this.video.requestVideoFrameCallback(
        this.getBind("onRequestVideoFrame") as VideoFrameRequestCallback
      );

      const target = event.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        const file = target.files[0];
        URL.revokeObjectURL(this.video.currentSrc);
        const url = URL.createObjectURL(file);
        this.video.src = url;
        this.facesList = [];
        this.video.play();
      }
    });
  }
  onEnded(event:Event){

    this.endedCount+=1;
    if(this.endedCount==2){
      console.log(this.facesList);
      const bson = serialize({
        video:{
          width:this.canvas.width,
          height:this.canvas.height,
        },
        facesList:this.facesList,
      });
      console.log(`bson.length: ${bson.length}`);
      console.log(bson);
  
      console.time("pako.gzip(bson)");
      const bson_gzip = pako.gzip(bson);
      console.timeEnd("pako.gzip(bson)");
      console.log(`bson_gzip.length: ${bson_gzip.length}`);
  
      let filename="download";
      if (this.file.files && this.file.files[0]) {
        const file = this.file.files[0];
        filename=file.name;
      }
  
      downloadBinary(bson_gzip,`${filename}.bson.gz`,"application/gzip");
    }else{
      this.video.load();
      this.video.playbackRate=RECORDER_PLAYBACK_RATE;
      this.video.play();
    }

  }
}
