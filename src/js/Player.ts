import { deserialize } from 'bson';
import * as pako from "pako";

import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";


import * as faceMesh from "@mediapipe/face_mesh";

import axios from "axios";

export default class Player{
  video:HTMLVideoElement;
  canvas:HTMLCanvasElement;
  context2d:CanvasRenderingContext2D;
  currentIndex:number;
  handleVideoFrameCallback:number|null;
  facesList: faceLandmarksDetection.Face[][];
  constructor(){
    this.video=document.createElement("video");
    this.canvas=document.createElement("canvas");
    this.context2d=this.canvas.getContext("2d");
    this.currentIndex=0;
    this.handleVideoFrameCallback=null;
    this.facesList=[];
    // TODO
    document.body.appendChild(this.canvas);

    this.video.addEventListener("ended",this.onEnded.bind(this));


    this.loadAsync().then(()=>{
      setTimeout(()=>{
        this.play();
      },1000);
    })

    
  }
  async loadAsync(){
    const mp4Url=`${window.relRoot}movie/kari.mp4`;
    const bsonGzUrl=`${mp4Url}.bson.gz`;
    const bsonGzBuffer=(await axios.get(bsonGzUrl,{ responseType : 'arraybuffer' })).data as ArrayBuffer;
    const bsonGz=new Uint8Array(bsonGzBuffer);
    console.time("pako.ungzip(bsonGz)");
    const bson = pako.ungzip(bsonGz);
    console.timeEnd("pako.ungzip(bsonGz)");
    const result=deserialize(bson);
    // console.log(result);
    this.facesList=result.facesList;

    this.video.src=mp4Url;

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
  play(){
    this.video.load();
    this.video.play();
    if(!("requestVideoFrameCallback" in this.video)){
      throw new Error("no requestVideoFrameCallback");
    }
    if(this.handleVideoFrameCallback!=null){
      this.video.cancelVideoFrameCallback(this.handleVideoFrameCallback);
      this.handleVideoFrameCallback=null;
    }
    this.handleVideoFrameCallback=this.video.requestVideoFrameCallback(this.onRequestVideoFrame.bind(this));
    this.currentIndex=0;
  }

  async onRequestVideoFrame(now: DOMHighResTimeStamp, metadata: VideoFrameMetadata) {
    this.handleVideoFrameCallback=this.video.requestVideoFrameCallback(this.onRequestVideoFrame.bind(this));

    this.canvas.width = metadata.width;
    this.canvas.height = metadata.height;
    this.context2d.drawImage(this.video, 0, 0);

    if(this.currentIndex<this.facesList.length){
      const faces=this.facesList[this.currentIndex];
      for(let face of faces){
        this.drawFace(face);
      }
    }else{
      console.error(`out of bounds ${this.currentIndex}/${this.facesList.length}`)
    }

    this.currentIndex += 1;

  }
  onEnded(event:Event){
    console.log("onEnded");
    if(this.handleVideoFrameCallback!=null){
      this.video.cancelVideoFrameCallback(this.handleVideoFrameCallback);
      this.handleVideoFrameCallback=null;
    }
  }
}