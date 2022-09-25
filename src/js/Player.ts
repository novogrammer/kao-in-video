import { deserialize } from 'bson';
import * as pako from "pako";

import * as faceLandmarksDetection from "@tensorflow-models/face-landmarks-detection";
import { setWasmPaths, version_wasm } from "@tensorflow/tfjs-backend-wasm";

setWasmPaths(`/assets/lib/@tensorflow/tfjs-backend-wasm@${version_wasm}/dist/`);


import * as faceMesh from "@mediapipe/face_mesh";

import axios from "axios";
import * as THREE from "three";
import { FACE_INDEX_LIST, NUM_KEYPOINTS } from './face_constants';

interface PlayerOptions{
  url:string;
}

interface ThreeObjects{
  renderer:THREE.WebGLRenderer;
  scene:THREE.Scene;
  camera:THREE.OrthographicCamera;
  faceMesh:THREE.Mesh;
}

export default class Player{
  video:HTMLVideoElement;
  canvas:HTMLCanvasElement;
  handleVideoFrameCallback:number|null;
  facesList: faceLandmarksDetection.Face[][];
  options: PlayerOptions;
  three:ThreeObjects|null=null;
  constructor(options:PlayerOptions){
    this.video=document.createElement("video");
    this.canvas=document.createElement("canvas");
    this.handleVideoFrameCallback=null;
    this.facesList=[];
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

    const videoTexture=new THREE.VideoTexture(this.video);
    videoTexture.encoding=THREE.sRGBEncoding;
    const material=new THREE.MeshBasicMaterial({
      // side:THREE.DoubleSide,
      color:0xff00ff,
      map:videoTexture,
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
  updateFaceMaterial(faceMesh:THREE.Mesh,face:faceLandmarksDetection.Face){
    const geometry=faceMesh.geometry;
    const material=faceMesh.material as THREE.MeshBasicMaterial;


    const width=this.canvas.width;
    const height=this.canvas.height;
    const uvList=[];
    for(let keypoint of face.keypoints){
      uvList.push(
        keypoint.x/width,
        1-keypoint.y/height,
      );
    }
    geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uvList,2));
    geometry.getAttribute("uv").needsUpdate=true;

    material.needsUpdate=true;

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
    const faceMesh=this.createFaceMesh();
    faceMesh.position.set(width*-0.5,height*-0.5,0);
    scene.add(faceMesh);

    const mesh=new THREE.Mesh(
      new THREE.BoxGeometry(10,10,10),
      new THREE.MeshBasicMaterial({color:0x00ff00})
    );
    scene.add(mesh);

    const camera = new THREE.OrthographicCamera(width * -0.5,width*0.5,height*0.5,height*-0.5,0,1000);
    camera.position.z=500;

    this.three={
      renderer,
      scene,
      camera,
      faceMesh,
    };
    
  }

  // drawFace(face: faceLandmarksDetection.Face) {
  //   this.context2d.save();
  //   this.context2d.strokeStyle = "#f00";
  //   this.context2d.strokeRect(face.box.xMin, face.box.yMin, face.box.width, face.box.height);
  //   this.context2d.strokeStyle = "#f0f";
  //   this.context2d.beginPath();
  //   // eslint-disable-next-line no-restricted-syntax
  //   for (const [fromIndex, toIndex] of faceMesh.FACEMESH_TESSELATION) {
  //     const from = face.keypoints[fromIndex];
  //     const to = face.keypoints[toIndex];
  //     this.context2d.moveTo(from.x, from.y);
  //     this.context2d.lineTo(to.x, to.y);
  //   }
  //   this.context2d.stroke();

  //   this.context2d.restore();
  // }
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
    const {renderer,scene,camera,faceMesh}=this.three;
    renderer.render(scene,camera);
    

    const currentIndex=Math.floor(this.facesList.length*this.video.currentTime/this.video.duration);
    if(currentIndex<this.facesList.length){
      const faces=this.facesList[currentIndex];
      if(0<faces.length){
        const face=faces[0];
        this.updateFaceGeometry(faceMesh,face);
        this.updateFaceMaterial(faceMesh,face);
        face.keypoints[0]
      }
      // for(let face of faces){
      //   this.drawFace(face);
      // }
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