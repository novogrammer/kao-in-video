import { deserialize } from 'bson';
import * as pako from "pako";

import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";
import { setWasmPaths, version_wasm } from "@tensorflow/tfjs-backend-wasm";

setWasmPaths(`/assets/lib/@tensorflow/tfjs-backend-wasm@${version_wasm}/dist/`);



import axios from "axios";
import * as THREE from "three";
import { RECORD_MAX_FACES } from './constants';
import { FaceObject3D } from './FaceObject3D';

interface PlayerOptions{
  url:string;
}

interface ThreeObjects{
  renderer:THREE.WebGLRenderer;
  scene:THREE.Scene;
  camera:THREE.OrthographicCamera;
  faceObject3DList:FaceObject3D[];
}

export default class Player{
  video:HTMLVideoElement;
  canvas:HTMLCanvasElement;
  handleVideoFrameCallback:number|null=null;
  facesList: faceLandmarksDetection.Face[][];
  sourceVideo: HTMLVideoElement;
  onEndedCallback:()=>void;
  options: PlayerOptions;
  three:ThreeObjects|null=null;
  constructor(sourceVideo:HTMLVideoElement,destinationCanvas:HTMLCanvasElement,onEndedCallback:()=>void,options:PlayerOptions){
    this.video=document.createElement("video");
    this.video.playsInline=true;
    this.video.muted=true;
    // this.video.loop=true;
    this.canvas=destinationCanvas;
    this.facesList=[];
    this.sourceVideo=sourceVideo;
    this.onEndedCallback=onEndedCallback;
    this.options=options;

    this.video.addEventListener("ended",this.onEnded.bind(this));


    this.loadAsync().then(async ()=>{
      await this.setupThreeAsync();
      this.play();
    })

    
  }
  async loadAsync(){
    const mp4Url=this.options.url;
    const bsonGzUrl=`${mp4Url}.bson.gz`;
    const bsonGzBuffer=(await axios.get(bsonGzUrl,{ responseType : 'arraybuffer' })).data as ArrayBuffer;
    const bsonGz=new Uint8Array(bsonGzBuffer);
    console.time("pako.ungzip(bsonGz)");
    const bson = pako.ungzip(bsonGz);
    console.timeEnd("pako.ungzip(bsonGz)");
    const result=deserialize(bson);
    // console.log(result);
    if(!result.facesList)
    {
      throw new Error("result.facesList is null");
    }
    this.facesList=result.facesList;
    if(!result.video)
    {
      throw new Error("result.video is null");
    }
    this.canvas.width=result.video.width;
    this.canvas.height=result.video.height;

    this.video.src=mp4Url;

  }

  updateFaceMaterialList(sourceFaceList:faceLandmarksDetection.Face[]){
    if(!this.three){
      console.log("this.three is null");
      return;
    }
    const {faceObject3DList}=this.three;
    if(0<sourceFaceList.length){
      const sourceFace=sourceFaceList[0];
      for(let faceObject3D of faceObject3DList){
        faceObject3D.updateFaceMaterial(sourceFace);
      }
    }else{
      // TODO: 一つもない時
    }

  }
  async setupThreeAsync(){
    const renderer=new THREE.WebGLRenderer({
      canvas:this.canvas,
    });
    renderer.outputEncoding=THREE.sRGBEncoding;
    const scene=new THREE.Scene();

    const width=this.canvas.width;
    const height=this.canvas.height;
    {
      const videoTexture = new THREE.VideoTexture(this.video);
      videoTexture.encoding=THREE.sRGBEncoding;
      const material=new THREE.MeshBasicMaterial({
        map:videoTexture,
      });
      const geometry=new THREE.PlaneGeometry(width,height);
      const videoMesh = new THREE.Mesh(geometry,material);
      videoMesh.position.z=-500+0.1;
      scene.add(videoMesh);
    }



    const faceObject3DList=[];
    for(let i=0;i<RECORD_MAX_FACES;++i){
      const faceObject3D=new FaceObject3D({sourceVideo:this.sourceVideo});
      faceObject3D.position.set(width*-0.5,height*-0.5,0);
      scene.add(faceObject3D);
      faceObject3DList.push(faceObject3D);
  
    }

    // const mesh=new THREE.Mesh(
    //   new THREE.BoxGeometry(10,10,10),
    //   new THREE.MeshBasicMaterial({color:0x00ff00})
    // );
    // scene.add(mesh);

    const camera = new THREE.OrthographicCamera(width * -0.5,width*0.5,height*0.5,height*-0.5,0,1000);
    camera.position.z=500;


    this.three={
      renderer,
      scene,
      camera,
      faceObject3DList: faceObject3DList,
    };
    
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
  }

  async onRequestVideoFrame(now: DOMHighResTimeStamp, metadata: VideoFrameMetadata) {
    this.handleVideoFrameCallback=this.video.requestVideoFrameCallback(this.onRequestVideoFrame.bind(this));

    // this.context2d.drawImage(this.video, 0, 0);
    if(!this.three){
      throw new Error("this.three is null");
    }
    const {renderer,scene,camera,faceObject3DList}=this.three;
    renderer.render(scene,camera);
    

    const currentIndex=Math.floor(this.facesList.length*this.video.currentTime/this.video.duration);
    if(currentIndex<this.facesList.length){
      const faces=this.facesList[currentIndex];
      for(let i=0;i<faceObject3DList.length;++i){
        const faceObject3D=faceObject3DList[i];
        if(i<faces.length){
          const face=faces[i];
          faceObject3D.updateFaceGeometry(face,this.canvas.height);
          faceObject3D.visible=true;
        }else{
          faceObject3D.visible=false;
        }
  
      }
    }else{
      console.error(`out of bounds ${currentIndex}/${this.facesList.length}`)
    }

  }
  onEnded(event:Event){
    console.log("onEnded");
    if(this.handleVideoFrameCallback!=null){
      this.video.cancelVideoFrameCallback(this.handleVideoFrameCallback);
      this.handleVideoFrameCallback=null;
    }
    if(this.onEndedCallback){
      this.onEndedCallback();
    }
  }
}