import React, { useRef, Suspense, useEffect, useState } from 'react';
import {
    FaPython, FaJava, FaReact, FaNodeJs, FaHtml5, FaCss3, FaDocker, FaGit,
} from 'react-icons/fa';
import { SiLua, SiRobloxstudio, SiElectron, SiCplusplus, SiNextdotjs, SiUnity, SiTypescript, SiPostgresql, SiFigma } from "react-icons/si";
import { motion, useInView } from 'framer-motion';
import { Canvas, useFrame, useThree, invalidate } from '@react-three/fiber';
import { useGLTF, Environment } from '@react-three/drei';
import * as THREE from 'three';
import '@styles/Components/HomePage/About.css';

interface CollapsibleSectionProps {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="collapsibleSection">
            <button
                className="collapsibleHeader"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="collapsibleTitle">{title}</span>
                <span className="collapsibleIcon">{isOpen ? '−' : '+'}</span>
            </button>
            <motion.div
                initial={false}
                animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                transition={{ duration: 0.3, ease: [0.215, 0.61, 0.355, 1] }}
                className="collapsibleContent"
            >
                <div className="collapsibleInner">
                    {children}
                </div>
            </motion.div>
        </div>
    );
};

// Component to set the camera from GLTF
const GLTFCamera: React.FC<{ cameras: THREE.Camera[] }> = ({ cameras }) => {
    const { set, size } = useThree();
    const [initialFov, setInitialFov] = useState<number | null>(null);

    useEffect(() => {
        if (cameras && cameras.length > 0) {
            const gltfCamera = cameras[0];

            if (gltfCamera instanceof THREE.PerspectiveCamera) {
                if (initialFov === null) {
                    const newFov = gltfCamera.fov * 1.1;
                    setInitialFov(newFov);
                    gltfCamera.fov = newFov;
                } else {
                    gltfCamera.fov = initialFov;
                }

                gltfCamera.aspect = size.width / size.height;
                gltfCamera.updateProjectionMatrix();
                console.log('Setting GLTF camera with aspect:', size.width / size.height, 'fov:', gltfCamera.fov);
                set({ camera: gltfCamera as THREE.PerspectiveCamera });
            }
        }
    }, [cameras, set, size, initialFov]);

    return null;
};

interface LaptopModelProps {
    scale: number;
    position: [number, number, number];
    rotation: [number, number, number];
    isOpen: boolean;
}

// Reusable Three.js objects to avoid GC pressure in useFrame
const tempVec3 = new THREE.Vector3();
const tempVec3_2 = new THREE.Vector3();
const tempQuat = new THREE.Quaternion();
const screenColor = new THREE.Color('#ffffff');

const LaptopModel: React.FC<LaptopModelProps> = ({ scale, position, rotation, isOpen }) => {
    const { scene, cameras } = useGLTF('/models/Laptop/thinkpad.glb');
    const topLidRef = useRef<THREE.Object3D | null>(null);
    const screenRef = useRef<THREE.Object3D | null>(null);
    const screenLightRef = useRef<THREE.PointLight>(null);
    const [targetRotation, setTargetRotation] = useState(Math.PI);

    const screenEmissiveIntensity = 1;
    const screenRotationOffset = 1.05;

    useEffect(() => {
        if (scene) {
            scene.traverse((child) => {
                const nameLower = child.name.toLowerCase();

                if (nameLower.includes('lid') || (nameLower.includes('top') && !nameLower.includes('screen'))) {
                    topLidRef.current = child;
                }
                if (nameLower.includes('screen') || nameLower.includes('display')) {
                    screenRef.current = child;
                }

                if (child instanceof THREE.Mesh) {
                    if (child.material) {
                        const material = Array.isArray(child.material)
                            ? child.material.map(mat => mat.clone())
                            : child.material.clone();

                        const isScreen = nameLower.includes('screen') || nameLower.includes('display');

                        const applyEnhancements = (mat: THREE.Material) => {
                            if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
                                if (isScreen) {
                                    mat.emissive = screenColor;
                                    mat.emissiveIntensity = screenEmissiveIntensity;
                                    mat.toneMapped = false;
                                } else {
                                    mat.metalness = Math.max(mat.metalness, 0.3);
                                    mat.roughness = Math.min(mat.roughness, 0.7);
                                    mat.envMapIntensity = 1.5;
                                }
                                mat.needsUpdate = true;
                            }
                        };

                        if (Array.isArray(material)) {
                            material.forEach(applyEnhancements);
                        } else {
                            applyEnhancements(material);
                        }

                        child.material = material;
                    }

                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
        }
    }, [scene]);

    useEffect(() => {
        setTargetRotation(isOpen ? Math.PI*0.12 : Math.PI*0.67);
        // Trigger render loop when open state changes
        invalidate();
    }, [isOpen]);

    useFrame((_, delta) => {
        // Clamp delta to prevent huge jumps after tab switch
        const clampedDelta = Math.min(delta, 0.1);
        const lerpFactor = 1 - Math.pow(0.001, clampedDelta);

        let needsUpdate = false;

        if (topLidRef.current) {
            const currentRotation = topLidRef.current.rotation.x;
            const diff = targetRotation - currentRotation;
            // Stop animating when close enough
            if (Math.abs(diff) > 0.001) {
                topLidRef.current.rotation.x += diff * lerpFactor;
                needsUpdate = true;
            }
        }

        if (screenRef.current) {
            const targetScreenRotation = targetRotation + screenRotationOffset;
            const currentRotation = screenRef.current.rotation.x;
            const diff = targetScreenRotation - currentRotation;
            if (Math.abs(diff) > 0.001) {
                screenRef.current.rotation.x += diff * lerpFactor;
                needsUpdate = true;
            }

            if (screenLightRef.current) {
                screenRef.current.getWorldPosition(tempVec3);
                screenRef.current.getWorldQuaternion(tempQuat);

                tempVec3_2.set(0, 0, 1);
                tempVec3_2.applyQuaternion(tempQuat);
                tempVec3_2.multiplyScalar(0.3);

                screenLightRef.current.position.copy(tempVec3.add(tempVec3_2));
                screenLightRef.current.intensity = isOpen ? 10 : 0;
            }
        }

        // Request next frame only if still animating
        if (needsUpdate) {
            invalidate();
        }
    });

    return (
        <group>
            {cameras && cameras.length > 0 && <GLTFCamera cameras={cameras} />}

            <pointLight
                ref={screenLightRef}
                color={screenColor}
                intensity={10}
                distance={5}
                decay={2}
            />

            <primitive
                object={scene}
                scale={scale}
                position={position}
                rotation={rotation}
            />

        </group>
    );
};

const About: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const laptopRef = useRef<HTMLDivElement>(null);
    const isInView = useInView(containerRef, { once: false, amount: 0.2 });
    const isLaptopInView = useInView(laptopRef, { once: false, amount: 0.5 });

    const scale = 1;
    const position: [number, number, number] = [0, 0, 0];
    const rotation: [number, number, number] = [0, 0, 0];

    const fadeIn = {
        hidden: { opacity: 0, y: 30 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.6,
                ease: [0.215, 0.61, 0.355, 1]
            }
        },
    };

    return (
        <div ref={containerRef} className="aboutSection">
            <div className="aboutContainer">
                <motion.div
                    className="aboutContent"
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    variants={fadeIn}
                >
                    <div className="aboutIntro">
                        <p className="aboutMainText">
                            I'm an <span className="highlight">18 year old developer</span> with <span className="highlight">5+ years </span>
                            of experience
                        </p>
                        <p className="aboutSubText">
                            I love building things that challenge me to<br />
                            <span className="highlight">think differently</span> and <span className="highlight">create something</span><br />
                            <span className="highlight">meanihandngful</span>.
                        </p>
                    </div>

                    <div className="aboutSkills">
                        <CollapsibleSection title="Languages:" defaultOpen={false}>
                            <div className="skillGrid">
                                <div className="skillItem"><SiCplusplus /> C++</div>
                                <div className="skillItem"><FaPython /> Python</div>
                                <div className="skillItem"><FaJava /> Java</div>
                                <div className="skillItem"><SiCplusplus /> C#</div>
                                <div className="skillItem"><SiLua /> Lua</div>
                                <div className="skillItem"><SiTypescript /> TypeScript</div>
                                <div className="skillItem"><FaHtml5 /> HTML</div>
                                <div className="skillItem"><FaCss3 /> CSS</div>
                            </div>
                        </CollapsibleSection>

                        <CollapsibleSection title="Technologies" defaultOpen={false}>
                            <div className="skillGrid">
                                <div className="skillItem"><FaReact /> React</div>
                                <div className="skillItem"><FaNodeJs /> Node.js</div>
                                <div className="skillItem"><SiNextdotjs /> Next.js</div>
                                <div className="skillItem"><SiElectron /> Electron</div>
                                <div className="skillItem"><SiUnity /> Unity</div>
                                <div className="skillItem"><SiRobloxstudio /> Roblox</div>
                                <div className="skillItem"><SiPostgresql /> PostgreSQL</div>
                            </div>
                        </CollapsibleSection>

                        <CollapsibleSection title="Tools" defaultOpen={false}>
                            <div className="skillGrid">
                                <div className="skillItem"><FaGit /> Git</div>
                                <div className="skillItem"><FaDocker /> Docker</div>
                                <div className="skillItem"><SiFigma /> Figma</div>
                            </div>
                        </CollapsibleSection>
                    </div>
                </motion.div>

                <motion.div
                    ref={laptopRef}
                    className="about3DContainer"
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    variants={fadeIn}
                >
                    <Canvas
                        shadows
                        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
                        frameloop="demand"
                    >
                        <Suspense fallback={null}>
                            <ambientLight intensity={0.3} />

                            <LaptopModel scale={scale} position={position} rotation={rotation} isOpen={isLaptopInView} />

                            <Environment preset="warehouse" />
                        </Suspense>
                    </Canvas>
                </motion.div>
            </div>
        </div>
    );
};

export default About;