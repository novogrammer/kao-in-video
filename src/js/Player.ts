import { deserialize } from 'bson';
import * as pako from "pako";

import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";
import { setWasmPaths, version_wasm } from "@tensorflow/tfjs-backend-wasm";

setWasmPaths(`/assets/lib/@tensorflow/tfjs-backend-wasm@${version_wasm}/dist/`);


import * as faceMesh from "@mediapipe/face_mesh";

import axios from "axios";
import * as THREE from "three";
import { FACE_INDEX_LIST, NUM_KEYPOINTS } from './face_constants';
import { RECORD_MAX_FACES, WEBCAM_HEIGHT, WEBCAM_WIDTH } from './constants';

interface PlayerOptions{
  url:string;
}

interface ThreeObjects{
  renderer:THREE.WebGLRenderer;
  scene:THREE.Scene;
  camera:THREE.OrthographicCamera;
  faceMeshList:THREE.Mesh[];
  sourceVideoTexture:THREE.VideoTexture;
}

export default class Player{
  video:HTMLVideoElement;
  canvas:HTMLCanvasElement;
  handleVideoFrameCallback:number|null=null;
  facesList: faceLandmarksDetection.Face[][];
  sourceVideo: HTMLVideoElement;
  options: PlayerOptions;
  three:ThreeObjects|null=null;
  constructor(sourceVideo:HTMLVideoElement,options:PlayerOptions){
    this.video=document.createElement("video");
    this.video.playsInline=true;
    this.video.muted=true;
    this.video.loop=true;
    this.canvas=document.createElement("canvas");
    this.facesList=[];
    this.sourceVideo=sourceVideo;
    this.options=options;
    // TODO
    document.body.appendChild(this.canvas);

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
  createFaceMesh(){
    const geometry=new THREE.BufferGeometry();
    geometry.setIndex(FACE_INDEX_LIST);
    const positionList=[];
    for(let i=0;i<NUM_KEYPOINTS;++i){
      positionList.push(0,0,0);
    }
    geometry.setAttribute("position",new THREE.Float32BufferAttribute(positionList,3));

    const uvList=[];
    for(let i=0;i<NUM_KEYPOINTS;++i){
      uvList.push(0,0);
    }
    geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uvList,2));

    const colorList=[];
    for(let i=0;i<NUM_KEYPOINTS;++i){
      if(faceMesh.FACEMESH_FACE_OVAL.some((landmarkConnection:[number, number])=>landmarkConnection.some((index)=>index==i))){
        colorList.push(1,1,1,0);
      }else{
        colorList.push(1,1,1,1);
      }
    }
    geometry.setAttribute("color",new THREE.Float32BufferAttribute(colorList,4));


    const videoTexture=new THREE.VideoTexture(this.video);
    videoTexture.encoding=THREE.sRGBEncoding;
    const material=new THREE.MeshBasicMaterial({
      // side:THREE.DoubleSide,
      // color:0xff00ff,
      map:videoTexture,
      transparent:true,
      vertexColors:true,
    });
    const mesh=new THREE.Mesh(geometry,material);
    mesh.frustumCulled = false;

    return mesh;
  }
  updateFaceGeometry(faceMesh:THREE.Mesh,face:faceLandmarksDetection.Face){
    const {geometry} = faceMesh;
    const height = this.canvas.height;
    const positionList=[];
    for(let keypoint of face.keypoints){
      positionList.push(keypoint.x,height - keypoint.y,keypoint.z);
    }

    geometry.setAttribute("position",new THREE.Float32BufferAttribute(positionList,3));
    geometry.getAttribute("position").needsUpdate=true;
    geometry.computeVertexNormals();

  }
  updateFaceMaterial(faceMesh:THREE.Mesh,sourceFace:faceLandmarksDetection.Face){
    const geometry=faceMesh.geometry;
    const material=faceMesh.material as THREE.MeshBasicMaterial;

    const {sourceVideoTexture}=this.three;

    const uvList=[];
    for(let keypoint of sourceFace.keypoints){
      uvList.push(
        keypoint.x/WEBCAM_WIDTH,
        1 - (keypoint.y/WEBCAM_HEIGHT),
      );
    }
    geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uvList,2));
    geometry.getAttribute("uv").needsUpdate=true;

    material.map=sourceVideoTexture;
    material.needsUpdate=true;

  }
  updateFaceMaterialList(sourceFaceList:faceLandmarksDetection.Face[]){
    if(!this.three){
      console.log("this.three is null");
      return;
    }
    const {faceMeshList}=this.three;
    if(0<sourceFaceList.length){
      const sourceFace=sourceFaceList[0];
      for(let faceMesh of faceMeshList){
        this.updateFaceMaterial(faceMesh,sourceFace);
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
    const faceMeshList=[];
    for(let i=0;i<RECORD_MAX_FACES;++i){
      const faceMesh=this.createFaceMesh();
      faceMesh.position.set(width*-0.5,height*-0.5,0);
      scene.add(faceMesh);
      faceMeshList.push(faceMesh);
  
    }

    // const mesh=new THREE.Mesh(
    //   new THREE.BoxGeometry(10,10,10),
    //   new THREE.MeshBasicMaterial({color:0x00ff00})
    // );
    // scene.add(mesh);

    const camera = new THREE.OrthographicCamera(width * -0.5,width*0.5,height*0.5,height*-0.5,0,1000);
    camera.position.z=500;

    const sourceVideoTexture = new THREE.VideoTexture(this.sourceVideo);
    sourceVideoTexture.encoding=THREE.sRGBEncoding;

    this.three={
      renderer,
      scene,
      camera,
      faceMeshList,
      sourceVideoTexture,
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
    const {renderer,scene,camera,faceMeshList}=this.three;
    renderer.render(scene,camera);
    

    const currentIndex=Math.floor(this.facesList.length*this.video.currentTime/this.video.duration);
    if(currentIndex<this.facesList.length){
      const faces=this.facesList[currentIndex];
      for(let i=0;i<faceMeshList.length;++i){
        const faceMesh=faceMeshList[i];
        if(i<faces.length){
          const face=faces[i];
          this.updateFaceGeometry(faceMesh,face);
          faceMesh.visible=true;
        }else{
          faceMesh.visible=false;
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
  }
}