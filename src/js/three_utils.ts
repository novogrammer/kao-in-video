export function disposeMaterial(material:THREE.Material){
  const {map}=material as any;
  if(map){
    map.dispose();
  }
  material.dispose();
}
export function disposeGeometry(geometry:THREE.BufferGeometry){
  geometry.dispose();
}


export function disposeMesh(mesh:THREE.Mesh){
  const {material,geometry}=mesh;
  if(Array.isArray(material)){
    const materialList=material as THREE.Material[];
    for(let material of materialList){
      disposeMaterial(material);
    }
  }else{
    disposeMaterial(material);
  }
  disposeGeometry(geometry);

}