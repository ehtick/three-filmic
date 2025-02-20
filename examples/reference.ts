import * as THREE from 'three';
import { EffectComposer, LookupTexture, RenderPass } from 'postprocessing';
import { FilmicPass, View, Look } from 'three-filmic';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader';
import { DataTexture } from 'three';

/******************************************************************************
 * Reference images.
 */

const WIDTH = 960;
const HEIGHT = 540;

const LOOK_OPTIONS: Record<Look, string> = {
	[Look.VERY_HIGH_CONTRAST]: '/luts/Filmic_to_1.20_1-00.ktx2',
	[Look.HIGH_CONTRAST]: '/luts/Filmic_to_0.99_1-0075.ktx2',
	[Look.MEDIUM_HIGH_CONTRAST]: '/luts/Filmic_to_0-85_1-011.ktx2',
	[Look.MEDIUM_CONTRAST]: '/luts/Filmic_to_0-70_1-03.ktx2',
	[Look.MEDIUM_LOW_CONTRAST]: '/luts/Filmic_to_0-60_1-04.ktx2',
	[Look.LOW_CONTRAST]: '/luts/Filmic_to_0-48_1-09.ktx2',
	[Look.VERY_LOW_CONTRAST]: '/luts/Filmic_to_0-35_1-30.ktx2',
};

const IMAGES = [
	{
		id: 'very_high',
		name: 'Very high contrast',
		view: View.FILMIC,
		look: Look.VERY_HIGH_CONTRAST,
	},
	{
		id: 'high',
		name: 'High contrast',
		view: View.FILMIC,
		look: Look.HIGH_CONTRAST,
	},
	{
		id: 'medium_high',
		name: 'Medium high contrast',
		view: View.FILMIC,
		look: Look.MEDIUM_HIGH_CONTRAST,
	},
	{
		id: 'medium',
		name: 'Medium contrast',
		view: View.FILMIC,
		look: Look.MEDIUM_CONTRAST,
	},
	{
		id: 'medium_low',
		name: 'Medium low contrast',
		view: View.FILMIC,
		look: Look.MEDIUM_LOW_CONTRAST,
	},
	{
		id: 'low',
		name: 'Low contrast',
		view: View.FILMIC,
		look: Look.LOW_CONTRAST,
	},
	{
		id: 'very_low',
		name: 'Very low contrast',
		view: View.FILMIC,
		look: Look.VERY_LOW_CONTRAST,
	},
	{
		id: 'false_color',
		name: 'False color',
		view: View.FALSE_COLOR,
		look: Look.NONE,
	},
];

/******************************************************************************
 * Setup.
 */

const ktx2Loader = new KTX2Loader();
const exrLoader = new EXRLoader();

let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;
let camera: THREE.Camera;

let composer: EffectComposer;
let filmicPass: FilmicPass;

async function init() {
	camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.25, 20);
	camera.position.set(0, 0, 1);

	// Scene.

	scene = new THREE.Scene();
	scene.add(camera);
	scene.background = await exrLoader.loadAsync('/reference/cornell_box.exr');
	(scene.background as THREE.Texture).encoding = THREE.LinearEncoding;

	// Renderer.

	renderer = new THREE.WebGLRenderer();
	renderer.physicallyCorrectLights = true;
	renderer.outputEncoding = THREE.sRGBEncoding;
	renderer.toneMapping = THREE.NoToneMapping;
	renderer.setPixelRatio(1);
	renderer.setSize(WIDTH, HEIGHT);
	renderer.setClearColor(0x4285f4);

	ktx2Loader.detectSupport(renderer);

	// Post-processing.

	filmicPass = new FilmicPass(camera);
	filmicPass.filmicLUT = LookupTexture.from(await ktx2Loader.loadAsync('/luts/desat65cube.ktx2'));
	filmicPass.filmicLUT.encoding = THREE.LinearEncoding;
	filmicPass.falseColorLUT = LookupTexture.from(
		await ktx2Loader.loadAsync('/luts/Filmic_False_Colour.ktx2')
	);
	filmicPass.falseColorLUT.encoding = THREE.sRGBEncoding;
	filmicPass.recompile();

	composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
	composer.setSize(WIDTH, HEIGHT);
	composer.addPass(new RenderPass(scene, camera));
	composer.addPass(filmicPass);
}

async function renderImage(canvasEl: HTMLCanvasElement, view: View, look: Look) {
	filmicPass.view = view;
	filmicPass.lookLUT = (await ktx2Loader.loadAsync(LOOK_OPTIONS[look])) as unknown as DataTexture;
	filmicPass.recompile();

	composer.render();

	const ctx = canvasEl.getContext('2d') as CanvasRenderingContext2D;
	ctx.drawImage(renderer.domElement, 0, 0);
}

/******************************************************************************
 * Render.
 */

main();

async function main() {
	await init();

	const mainEl = document.querySelector('main')!;

	for (const image of IMAGES) {
		const sectionEl = document.createElement('section');
		mainEl.appendChild(sectionEl);
		sectionEl.innerHTML = `
<h2>${image.name}</h2>
<figure>
	<img src="/reference/out/${image.id}.png" alt="">
	<canvas id="${image.id}" width=960 height=540></canvas>
	<figcaption>
		<div class="caption -left">OpenImageIO</div>
		<div class="caption -right">three-filmic</div>
	</figcaption>
</figure>
		`.trim();

		const canvasEl = sectionEl.querySelector('canvas') as HTMLCanvasElement;

		await renderImage(canvasEl, image.view, image.look);
	}
}
