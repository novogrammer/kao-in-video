import { deserialize } from 'bson';
import * as pako from "pako";

import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";
import { setWasmPaths, version_wasm } from "@tensorflow/tfjs-backend-wasm";

setWasmPaths(`/assets/lib/@tensorflow/tfjs-backend-wasm@${version_wasm}/dist/`);



import axios from "axios";
import * as THREE from "three";
import { RECORD_MAX_FACES } from './constants';
import { FaceObject3D } from './FaceObject3D';
import { disposeMesh } from './three_utils';

interface PlayerOptions{
  url:string;
}

interface ThreeObjects{
  scene:THREE.Scene;
  camera:THREE.OrthographicCamera;
  faceObject3DList:FaceObject3D[];
}

export default class Player{
  video:HTMLVideoElement;
  canvas:HTMLCanvasElement;
  facesList: faceLandmarksDetection.Face[][];
  sourceVideo: HTMLVideoElement;
  onEndedCallback:()=>void;
  options: PlayerOptions;
  three:ThreeObjects|null=null;
  setupThreePromise:Promise<void>|null=null;
  isPlaying:boolean=false;
  renderer:THREE.WebGLRenderer;
  constructor(renderer:THREE.WebGLRenderer,sourceVideo:HTMLVideoElement,destinationCanvas:HTMLCanvasElement,onEndedCallback:()=>void,options:PlayerOptions){
    this.renderer=renderer;
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

    this.setup();

  }
  setup(){
    this.loadAsync().then(async ()=>{
      this.setupThreePromise=this.setupThreeAsync();
      await this.setupThreePromise;
      this.play();
    });
  }
  destroy(){
    this.stop();
    // awaitしない
    this.destroyThreeAsync();
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
        faceObject3D.isReal=true;
      }
    }else{
      for(let faceObject3D of faceObject3DList){
        faceObject3D.isReal=false;
      }
    }

  }
  async setupThreeAsync(){
    const scene=new THREE.Scene();

    {
      const hemisphereLight = new THREE.HemisphereLight( 0xffffbb, 0x080820, 1 );
      scene.add(hemisphereLight);
       
    }
    {
      const cubeTextureLoader = new THREE.CubeTextureLoader();
      cubeTextureLoader.setPath( 'assets/textures/cube/Bridge2/' );
  
      const textureCube = cubeTextureLoader.load( [ 'posx.jpg', 'negx.jpg', 'posy.jpg', 'negy.jpg', 'posz.jpg', 'negz.jpg' ] );
      textureCube.encoding = THREE.sRGBEncoding;
      // scene.background = textureCube;
      scene.environment=textureCube;
    }

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
      scene,
      camera,
      faceObject3DList: faceObject3DList,
    };
    
  }
  async destroyThreeAsync(){
    if(this.setupThreePromise){
      await this.setupThreePromise;
    }
    const {three}=this;
    if(three){
      this.three=null;
      const {scene,faceObject3DList}=three;
      scene.traverse((object3D)=>{
        if(object3D instanceof THREE.Mesh){
          const mesh:THREE.Mesh = object3D;
          disposeMesh(mesh);
        }
      });
      const {environment}=scene;
      if(environment){
        environment.dispose();
      }
      for(let faceObject3D of faceObject3DList){
        faceObject3D.destroy();
      }
    }
  }

  play(){
    this.video.load();
    this.video.play();
    this.isPlaying=true;
  }
  stop(){
    this.video.pause();
    this.isPlaying=false;
  }

  async onTickAsync() {

    // this.context2d.drawImage(this.video, 0, 0);
    if(!this.three){
      console.log("this.three is null");
      return;
    }
    if(isNaN(this.video.duration)){
      console.log("isNaN(this.video.duration)");
      return;
    }
    const {scene,camera,faceObject3DList}=this.three;
    const {renderer}=this;

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
      console.log(`out of bounds ${currentIndex}/${this.facesList.length}`)
    }
    renderer.render(scene,camera);

  }
  onEnded(event:Event){
    console.log("onEnded");
    this.isPlaying=false;
    if(this.onEndedCallback){
      this.onEndedCallback();
    }
  }
}