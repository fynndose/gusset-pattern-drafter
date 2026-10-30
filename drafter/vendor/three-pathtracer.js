/* three-gpu-pathtracer 0.0.17 and three-mesh-bvh 0.7.0 (both MIT, © Garrett Johnson: three-pathtracer.LICENSE.txt) with three.js's FullScreenQuad, bundled as one classic script that reads the global THREE and sets THREE_PATHTRACER (vendor/README.md says how). */
(()=>{var Yn=Object.defineProperty;var A=(o,e)=>()=>(o&&(e=o(o=0)),e);var $n=(o,e)=>()=>(e||o((e={exports:{}}).exports,e),e.exports),jn=(o,e)=>{for(var t in e)Yn(o,t,{get:e[t],enumerable:!0})};var Wa,qa,Xa,Ya,$a,ja,Ka,Qa,Za,Ja,el,tl,rl,ol,il,sl,nl,al,ll,cl,ul,fl,pl,ml,hl,dl,St,gl,xl,Tl,bl,vl,yl,J,El,Rl,Sl,Y,xe,wl,Pr,Al,_l,Ml,Cl,Fl,Il,Hl,Bl,ue,Dl,fe,Pl,Ll,Gl,Nl,Ol,zl,Ul,kl,Vl,Wl,ql,Xl,Yl,$l,jl,Kl,Ql,Zl,Jl,ec,tc,rc,oc,ic,sc,nc,ac,lc,cc,Ro,K,uc,se,fc,pc,mc,hc,dc,gc,xc,Tc,bc,vc,yc,Ec,wt,Rc,Sc,wc,Ac,_c,Mc,Cc,Fc,Ic,Hc,So,Bc,Dc,Pc,Lc,wo,Gc,At,Nc,j,Oc,zc,Uc,ut,kc,Vc,Wc,qc,Xc,Yc,$c,jc,Kc,Qc,Zc,Jc,ee,eu,tu,ru,ou,iu,su,nu,au,Kn,lu,cu,uu,fu,pu,mu,_t,Qn,Zn,hu,du,gu,xu,Tu,bu,vu,yu,Eu,Ru,Su,wu,Au,_u,Mu,Cu,Fu,Iu,Hu,ae,Bu,Du,Pu,Lu,Gu,Nu,Ou,zu,X,Uu,ku,Vu,Wu,qu,Xu,Yu,$u,Ao,ju,Ku,Qu,Zu,Ju,ef,tf,rf,of,sf,Mt,_o,z,nf,Ct,Ft,af,lf,cf,uf,ff,pf,mf,hf,df,gf,xf,Tf,bf,vf,te,yf,Ef,Rf,Sf,wf,Af,_f,Oe,Mf,It,Cf,Mo,Ff,If,Hf,Bf,Df,Pf,Lf,Gf,Nf,Of,zf,Uf,kf,Vf,Wf,Co,qf,Xf,Yf,$f,jf,Fo,Ht,Kf,Qf,Zf,Jf,ep,tp,rp,op,ip,sp,np,ap,lp,Io,cp,up,fp,pp,mp,hp,O,Bt,dp,gp,xp,Tp,bp,vp,yp,Ep,Rp,Sp,wp,Ap,_p,Mp,Cp,Fp,Ip,Hp,Bp,Dp,Pp,Lp,Gp,Np,Op,zp,Up,kp,Ho,Dt,Vp,Wp,qp,Xp,Yp,ye,Bo,$p,jp,me,Kp,Qp,Zp,Jp,em,tm,rm,om,im,sm,Do,nm,am,lm,cm,um,Po,fm,pm,mm,Lo,Go,hm,No,dm,gm,xm,Tm,bm,vm,ym,Em,Rm,Sm,wm,Am,_m,Mm,Cm,Fm,Im,Hm,Bm,Dm,Pm,Lm,Gm,Nm,Om,zm,Ee,Jn,ea,ta,Um,km,Vm,Wm,qm,Xm,Ym,$m,jm,Km,Qm,ft,Zm,Fe,Jm,eh,Oo,th,Q,C,he,rh,oh,ih,sh,Pt,nh,ah,lh,ze,ch,uh,fh,ph,mh,hh,dh,gh,xh,Th,bh,vh,B=A(()=>{Wa=globalThis.THREE.ACESFilmicToneMapping,qa=globalThis.THREE.AddEquation,Xa=globalThis.THREE.AddOperation,Ya=globalThis.THREE.AdditiveAnimationBlendMode,$a=globalThis.THREE.AdditiveBlending,ja=globalThis.THREE.AlphaFormat,Ka=globalThis.THREE.AlwaysCompare,Qa=globalThis.THREE.AlwaysDepth,Za=globalThis.THREE.AlwaysStencilFunc,Ja=globalThis.THREE.AmbientLight,el=globalThis.THREE.AnimationAction,tl=globalThis.THREE.AnimationClip,rl=globalThis.THREE.AnimationLoader,ol=globalThis.THREE.AnimationMixer,il=globalThis.THREE.AnimationObjectGroup,sl=globalThis.THREE.AnimationUtils,nl=globalThis.THREE.ArcCurve,al=globalThis.THREE.ArrayCamera,ll=globalThis.THREE.ArrowHelper,cl=globalThis.THREE.AttachedBindMode,ul=globalThis.THREE.Audio,fl=globalThis.THREE.AudioAnalyser,pl=globalThis.THREE.AudioContext,ml=globalThis.THREE.AudioListener,hl=globalThis.THREE.AudioLoader,dl=globalThis.THREE.AxesHelper,St=globalThis.THREE.BackSide,gl=globalThis.THREE.BasicDepthPacking,xl=globalThis.THREE.BasicShadowMap,Tl=globalThis.THREE.BatchedMesh,bl=globalThis.THREE.Bone,vl=globalThis.THREE.BooleanKeyframeTrack,yl=globalThis.THREE.Box2,J=globalThis.THREE.Box3,El=globalThis.THREE.Box3Helper,Rl=globalThis.THREE.BoxGeometry,Sl=globalThis.THREE.BoxHelper,Y=globalThis.THREE.BufferAttribute,xe=globalThis.THREE.BufferGeometry,wl=globalThis.THREE.BufferGeometryLoader,Pr=globalThis.THREE.ByteType,Al=globalThis.THREE.Cache,_l=globalThis.THREE.Camera,Ml=globalThis.THREE.CameraHelper,Cl=globalThis.THREE.CanvasTexture,Fl=globalThis.THREE.CapsuleGeometry,Il=globalThis.THREE.CatmullRomCurve3,Hl=globalThis.THREE.CineonToneMapping,Bl=globalThis.THREE.CircleGeometry,ue=globalThis.THREE.ClampToEdgeWrapping,Dl=globalThis.THREE.Clock,fe=globalThis.THREE.Color,Pl=globalThis.THREE.ColorKeyframeTrack,Ll=globalThis.THREE.ColorManagement,Gl=globalThis.THREE.CompressedArrayTexture,Nl=globalThis.THREE.CompressedCubeTexture,Ol=globalThis.THREE.CompressedTexture,zl=globalThis.THREE.CompressedTextureLoader,Ul=globalThis.THREE.ConeGeometry,kl=globalThis.THREE.ConstantAlphaFactor,Vl=globalThis.THREE.ConstantColorFactor,Wl=globalThis.THREE.CubeCamera,ql=globalThis.THREE.CubeReflectionMapping,Xl=globalThis.THREE.CubeRefractionMapping,Yl=globalThis.THREE.CubeTexture,$l=globalThis.THREE.CubeTextureLoader,jl=globalThis.THREE.CubeUVReflectionMapping,Kl=globalThis.THREE.CubicBezierCurve,Ql=globalThis.THREE.CubicBezierCurve3,Zl=globalThis.THREE.CubicInterpolant,Jl=globalThis.THREE.CullFaceBack,ec=globalThis.THREE.CullFaceFront,tc=globalThis.THREE.CullFaceFrontBack,rc=globalThis.THREE.CullFaceNone,oc=globalThis.THREE.Curve,ic=globalThis.THREE.CurvePath,sc=globalThis.THREE.CustomBlending,nc=globalThis.THREE.CustomToneMapping,ac=globalThis.THREE.CylinderGeometry,lc=globalThis.THREE.Cylindrical,cc=globalThis.THREE.Data3DTexture,Ro=globalThis.THREE.DataArrayTexture,K=globalThis.THREE.DataTexture,uc=globalThis.THREE.DataTextureLoader,se=globalThis.THREE.DataUtils,fc=globalThis.THREE.DecrementStencilOp,pc=globalThis.THREE.DecrementWrapStencilOp,mc=globalThis.THREE.DefaultLoadingManager,hc=globalThis.THREE.DepthFormat,dc=globalThis.THREE.DepthStencilFormat,gc=globalThis.THREE.DepthTexture,xc=globalThis.THREE.DetachedBindMode,Tc=globalThis.THREE.DirectionalLight,bc=globalThis.THREE.DirectionalLightHelper,vc=globalThis.THREE.DiscreteInterpolant,yc=globalThis.THREE.DisplayP3ColorSpace,Ec=globalThis.THREE.DodecahedronGeometry,wt=globalThis.THREE.DoubleSide,Rc=globalThis.THREE.DstAlphaFactor,Sc=globalThis.THREE.DstColorFactor,wc=globalThis.THREE.DynamicCopyUsage,Ac=globalThis.THREE.DynamicDrawUsage,_c=globalThis.THREE.DynamicReadUsage,Mc=globalThis.THREE.EdgesGeometry,Cc=globalThis.THREE.EllipseCurve,Fc=globalThis.THREE.EqualCompare,Ic=globalThis.THREE.EqualDepth,Hc=globalThis.THREE.EqualStencilFunc,So=globalThis.THREE.EquirectangularReflectionMapping,Bc=globalThis.THREE.EquirectangularRefractionMapping,Dc=globalThis.THREE.Euler,Pc=globalThis.THREE.EventDispatcher,Lc=globalThis.THREE.ExtrudeGeometry,wo=globalThis.THREE.FileLoader,Gc=globalThis.THREE.Float16BufferAttribute,At=globalThis.THREE.Float32BufferAttribute,Nc=globalThis.THREE.Float64BufferAttribute,j=globalThis.THREE.FloatType,Oc=globalThis.THREE.Fog,zc=globalThis.THREE.FogExp2,Uc=globalThis.THREE.FramebufferTexture,ut=globalThis.THREE.FrontSide,kc=globalThis.THREE.Frustum,Vc=globalThis.THREE.GLBufferAttribute,Wc=globalThis.THREE.GLSL1,qc=globalThis.THREE.GLSL3,Xc=globalThis.THREE.GreaterCompare,Yc=globalThis.THREE.GreaterDepth,$c=globalThis.THREE.GreaterEqualCompare,jc=globalThis.THREE.GreaterEqualDepth,Kc=globalThis.THREE.GreaterEqualStencilFunc,Qc=globalThis.THREE.GreaterStencilFunc,Zc=globalThis.THREE.GridHelper,Jc=globalThis.THREE.Group,ee=globalThis.THREE.HalfFloatType,eu=globalThis.THREE.HemisphereLight,tu=globalThis.THREE.HemisphereLightHelper,ru=globalThis.THREE.IcosahedronGeometry,ou=globalThis.THREE.ImageBitmapLoader,iu=globalThis.THREE.ImageLoader,su=globalThis.THREE.ImageUtils,nu=globalThis.THREE.IncrementStencilOp,au=globalThis.THREE.IncrementWrapStencilOp,Kn=globalThis.THREE.InstancedBufferAttribute,lu=globalThis.THREE.InstancedBufferGeometry,cu=globalThis.THREE.InstancedInterleavedBuffer,uu=globalThis.THREE.InstancedMesh,fu=globalThis.THREE.Int16BufferAttribute,pu=globalThis.THREE.Int32BufferAttribute,mu=globalThis.THREE.Int8BufferAttribute,_t=globalThis.THREE.IntType,Qn=globalThis.THREE.InterleavedBuffer,Zn=globalThis.THREE.InterleavedBufferAttribute,hu=globalThis.THREE.Interpolant,du=globalThis.THREE.InterpolateDiscrete,gu=globalThis.THREE.InterpolateLinear,xu=globalThis.THREE.InterpolateSmooth,Tu=globalThis.THREE.InvertStencilOp,bu=globalThis.THREE.KeepStencilOp,vu=globalThis.THREE.KeyframeTrack,yu=globalThis.THREE.LOD,Eu=globalThis.THREE.LatheGeometry,Ru=globalThis.THREE.Layers,Su=globalThis.THREE.LessCompare,wu=globalThis.THREE.LessDepth,Au=globalThis.THREE.LessEqualCompare,_u=globalThis.THREE.LessEqualDepth,Mu=globalThis.THREE.LessEqualStencilFunc,Cu=globalThis.THREE.LessStencilFunc,Fu=globalThis.THREE.Light,Iu=globalThis.THREE.LightProbe,Hu=globalThis.THREE.Line,ae=globalThis.THREE.Line3,Bu=globalThis.THREE.LineBasicMaterial,Du=globalThis.THREE.LineCurve,Pu=globalThis.THREE.LineCurve3,Lu=globalThis.THREE.LineDashedMaterial,Gu=globalThis.THREE.LineLoop,Nu=globalThis.THREE.LineSegments,Ou=globalThis.THREE.LinearDisplayP3ColorSpace,zu=globalThis.THREE.LinearEncoding,X=globalThis.THREE.LinearFilter,Uu=globalThis.THREE.LinearInterpolant,ku=globalThis.THREE.LinearMipMapLinearFilter,Vu=globalThis.THREE.LinearMipMapNearestFilter,Wu=globalThis.THREE.LinearMipmapLinearFilter,qu=globalThis.THREE.LinearMipmapNearestFilter,Xu=globalThis.THREE.LinearSRGBColorSpace,Yu=globalThis.THREE.LinearToneMapping,$u=globalThis.THREE.LinearTransfer,Ao=globalThis.THREE.Loader,ju=globalThis.THREE.LoaderUtils,Ku=globalThis.THREE.LoadingManager,Qu=globalThis.THREE.LoopOnce,Zu=globalThis.THREE.LoopPingPong,Ju=globalThis.THREE.LoopRepeat,ef=globalThis.THREE.LuminanceAlphaFormat,tf=globalThis.THREE.LuminanceFormat,rf=globalThis.THREE.MOUSE,of=globalThis.THREE.Material,sf=globalThis.THREE.MaterialLoader,Mt=globalThis.THREE.MathUtils,_o=globalThis.THREE.Matrix3,z=globalThis.THREE.Matrix4,nf=globalThis.THREE.MaxEquation,Ct=globalThis.THREE.Mesh,Ft=globalThis.THREE.MeshBasicMaterial,af=globalThis.THREE.MeshDepthMaterial,lf=globalThis.THREE.MeshDistanceMaterial,cf=globalThis.THREE.MeshLambertMaterial,uf=globalThis.THREE.MeshMatcapMaterial,ff=globalThis.THREE.MeshNormalMaterial,pf=globalThis.THREE.MeshPhongMaterial,mf=globalThis.THREE.MeshPhysicalMaterial,hf=globalThis.THREE.MeshStandardMaterial,df=globalThis.THREE.MeshToonMaterial,gf=globalThis.THREE.MinEquation,xf=globalThis.THREE.MirroredRepeatWrapping,Tf=globalThis.THREE.MixOperation,bf=globalThis.THREE.MultiplyBlending,vf=globalThis.THREE.MultiplyOperation,te=globalThis.THREE.NearestFilter,yf=globalThis.THREE.NearestMipMapLinearFilter,Ef=globalThis.THREE.NearestMipMapNearestFilter,Rf=globalThis.THREE.NearestMipmapLinearFilter,Sf=globalThis.THREE.NearestMipmapNearestFilter,wf=globalThis.THREE.NeverCompare,Af=globalThis.THREE.NeverDepth,_f=globalThis.THREE.NeverStencilFunc,Oe=globalThis.THREE.NoBlending,Mf=globalThis.THREE.NoColorSpace,It=globalThis.THREE.NoToneMapping,Cf=globalThis.THREE.NormalAnimationBlendMode,Mo=globalThis.THREE.NormalBlending,Ff=globalThis.THREE.NotEqualCompare,If=globalThis.THREE.NotEqualDepth,Hf=globalThis.THREE.NotEqualStencilFunc,Bf=globalThis.THREE.NumberKeyframeTrack,Df=globalThis.THREE.Object3D,Pf=globalThis.THREE.ObjectLoader,Lf=globalThis.THREE.ObjectSpaceNormalMap,Gf=globalThis.THREE.OctahedronGeometry,Nf=globalThis.THREE.OneFactor,Of=globalThis.THREE.OneMinusConstantAlphaFactor,zf=globalThis.THREE.OneMinusConstantColorFactor,Uf=globalThis.THREE.OneMinusDstAlphaFactor,kf=globalThis.THREE.OneMinusDstColorFactor,Vf=globalThis.THREE.OneMinusSrcAlphaFactor,Wf=globalThis.THREE.OneMinusSrcColorFactor,Co=globalThis.THREE.OrthographicCamera,qf=globalThis.THREE.P3Primaries,Xf=globalThis.THREE.PCFShadowMap,Yf=globalThis.THREE.PCFSoftShadowMap,$f=globalThis.THREE.PMREMGenerator,jf=globalThis.THREE.Path,Fo=globalThis.THREE.PerspectiveCamera,Ht=globalThis.THREE.Plane,Kf=globalThis.THREE.PlaneGeometry,Qf=globalThis.THREE.PlaneHelper,Zf=globalThis.THREE.PointLight,Jf=globalThis.THREE.PointLightHelper,ep=globalThis.THREE.Points,tp=globalThis.THREE.PointsMaterial,rp=globalThis.THREE.PolarGridHelper,op=globalThis.THREE.PolyhedronGeometry,ip=globalThis.THREE.PositionalAudio,sp=globalThis.THREE.PropertyBinding,np=globalThis.THREE.PropertyMixer,ap=globalThis.THREE.QuadraticBezierCurve,lp=globalThis.THREE.QuadraticBezierCurve3,Io=globalThis.THREE.Quaternion,cp=globalThis.THREE.QuaternionKeyframeTrack,up=globalThis.THREE.QuaternionLinearInterpolant,fp=globalThis.THREE.RED_GREEN_RGTC2_Format,pp=globalThis.THREE.RED_RGTC1_Format,mp=globalThis.THREE.REVISION,hp=globalThis.THREE.RGBADepthPacking,O=globalThis.THREE.RGBAFormat,Bt=globalThis.THREE.RGBAIntegerFormat,dp=globalThis.THREE.RGBA_ASTC_10x10_Format,gp=globalThis.THREE.RGBA_ASTC_10x5_Format,xp=globalThis.THREE.RGBA_ASTC_10x6_Format,Tp=globalThis.THREE.RGBA_ASTC_10x8_Format,bp=globalThis.THREE.RGBA_ASTC_12x10_Format,vp=globalThis.THREE.RGBA_ASTC_12x12_Format,yp=globalThis.THREE.RGBA_ASTC_4x4_Format,Ep=globalThis.THREE.RGBA_ASTC_5x4_Format,Rp=globalThis.THREE.RGBA_ASTC_5x5_Format,Sp=globalThis.THREE.RGBA_ASTC_6x5_Format,wp=globalThis.THREE.RGBA_ASTC_6x6_Format,Ap=globalThis.THREE.RGBA_ASTC_8x5_Format,_p=globalThis.THREE.RGBA_ASTC_8x6_Format,Mp=globalThis.THREE.RGBA_ASTC_8x8_Format,Cp=globalThis.THREE.RGBA_BPTC_Format,Fp=globalThis.THREE.RGBA_ETC2_EAC_Format,Ip=globalThis.THREE.RGBA_PVRTC_2BPPV1_Format,Hp=globalThis.THREE.RGBA_PVRTC_4BPPV1_Format,Bp=globalThis.THREE.RGBA_S3TC_DXT1_Format,Dp=globalThis.THREE.RGBA_S3TC_DXT3_Format,Pp=globalThis.THREE.RGBA_S3TC_DXT5_Format,Lp=globalThis.THREE.RGB_BPTC_SIGNED_Format,Gp=globalThis.THREE.RGB_BPTC_UNSIGNED_Format,Np=globalThis.THREE.RGB_ETC1_Format,Op=globalThis.THREE.RGB_ETC2_Format,zp=globalThis.THREE.RGB_PVRTC_2BPPV1_Format,Up=globalThis.THREE.RGB_PVRTC_4BPPV1_Format,kp=globalThis.THREE.RGB_S3TC_DXT1_Format,Ho=globalThis.THREE.RGFormat,Dt=globalThis.THREE.RGIntegerFormat,Vp=globalThis.THREE.RawShaderMaterial,Wp=globalThis.THREE.Ray,qp=globalThis.THREE.Raycaster,Xp=globalThis.THREE.Rec709Primaries,Yp=globalThis.THREE.RectAreaLight,ye=globalThis.THREE.RedFormat,Bo=globalThis.THREE.RedIntegerFormat,$p=globalThis.THREE.ReinhardToneMapping,jp=globalThis.THREE.RenderTarget,me=globalThis.THREE.RepeatWrapping,Kp=globalThis.THREE.ReplaceStencilOp,Qp=globalThis.THREE.ReverseSubtractEquation,Zp=globalThis.THREE.RingGeometry,Jp=globalThis.THREE.SIGNED_RED_GREEN_RGTC2_Format,em=globalThis.THREE.SIGNED_RED_RGTC1_Format,tm=globalThis.THREE.SRGBColorSpace,rm=globalThis.THREE.SRGBTransfer,om=globalThis.THREE.Scene,im=globalThis.THREE.ShaderChunk,sm=globalThis.THREE.ShaderLib,Do=globalThis.THREE.ShaderMaterial,nm=globalThis.THREE.ShadowMaterial,am=globalThis.THREE.Shape,lm=globalThis.THREE.ShapeGeometry,cm=globalThis.THREE.ShapePath,um=globalThis.THREE.ShapeUtils,Po=globalThis.THREE.ShortType,fm=globalThis.THREE.Skeleton,pm=globalThis.THREE.SkeletonHelper,mm=globalThis.THREE.SkinnedMesh,Lo=globalThis.THREE.Source,Go=globalThis.THREE.Sphere,hm=globalThis.THREE.SphereGeometry,No=globalThis.THREE.Spherical,dm=globalThis.THREE.SphericalHarmonics3,gm=globalThis.THREE.SplineCurve,xm=globalThis.THREE.SpotLight,Tm=globalThis.THREE.SpotLightHelper,bm=globalThis.THREE.Sprite,vm=globalThis.THREE.SpriteMaterial,ym=globalThis.THREE.SrcAlphaFactor,Em=globalThis.THREE.SrcAlphaSaturateFactor,Rm=globalThis.THREE.SrcColorFactor,Sm=globalThis.THREE.StaticCopyUsage,wm=globalThis.THREE.StaticDrawUsage,Am=globalThis.THREE.StaticReadUsage,_m=globalThis.THREE.StereoCamera,Mm=globalThis.THREE.StreamCopyUsage,Cm=globalThis.THREE.StreamDrawUsage,Fm=globalThis.THREE.StreamReadUsage,Im=globalThis.THREE.StringKeyframeTrack,Hm=globalThis.THREE.SubtractEquation,Bm=globalThis.THREE.SubtractiveBlending,Dm=globalThis.THREE.TOUCH,Pm=globalThis.THREE.TangentSpaceNormalMap,Lm=globalThis.THREE.TetrahedronGeometry,Gm=globalThis.THREE.Texture,Nm=globalThis.THREE.TextureLoader,Om=globalThis.THREE.TorusGeometry,zm=globalThis.THREE.TorusKnotGeometry,Ee=globalThis.THREE.Triangle,Jn=globalThis.THREE.TriangleFanDrawMode,ea=globalThis.THREE.TriangleStripDrawMode,ta=globalThis.THREE.TrianglesDrawMode,Um=globalThis.THREE.TubeGeometry,km=globalThis.THREE.TwoPassDoubleSide,Vm=globalThis.THREE.UVMapping,Wm=globalThis.THREE.Uint16BufferAttribute,qm=globalThis.THREE.Uint32BufferAttribute,Xm=globalThis.THREE.Uint8BufferAttribute,Ym=globalThis.THREE.Uint8ClampedBufferAttribute,$m=globalThis.THREE.Uniform,jm=globalThis.THREE.UniformsGroup,Km=globalThis.THREE.UniformsLib,Qm=globalThis.THREE.UniformsUtils,ft=globalThis.THREE.UnsignedByteType,Zm=globalThis.THREE.UnsignedInt248Type,Fe=globalThis.THREE.UnsignedIntType,Jm=globalThis.THREE.UnsignedShort4444Type,eh=globalThis.THREE.UnsignedShort5551Type,Oo=globalThis.THREE.UnsignedShortType,th=globalThis.THREE.VSMShadowMap,Q=globalThis.THREE.Vector2,C=globalThis.THREE.Vector3,he=globalThis.THREE.Vector4,rh=globalThis.THREE.VectorKeyframeTrack,oh=globalThis.THREE.VideoTexture,ih=globalThis.THREE.WebGL1Renderer,sh=globalThis.THREE.WebGL3DRenderTarget,Pt=globalThis.THREE.WebGLArrayRenderTarget,nh=globalThis.THREE.WebGLCoordinateSystem,ah=globalThis.THREE.WebGLCubeRenderTarget,lh=globalThis.THREE.WebGLMultipleRenderTargets,ze=globalThis.THREE.WebGLRenderTarget,ch=globalThis.THREE.WebGLRenderer,uh=globalThis.THREE.WebGLUtils,fh=globalThis.THREE.WebGPUCoordinateSystem,ph=globalThis.THREE.WireframeGeometry,mh=globalThis.THREE.WrapAroundEnding,hh=globalThis.THREE.ZeroCurvatureEnding,dh=globalThis.THREE.ZeroFactor,gh=globalThis.THREE.ZeroSlopeEnding,xh=globalThis.THREE.ZeroStencilOp,Th=globalThis.THREE._SRGBAFormat,bh=globalThis.THREE.createCanvasElement,vh=globalThis.THREE.sRGBEncoding});var ra,Lr,oa,ne,Ue=A(()=>{B();ra=new Co(-1,1,1,-1,0,1),Lr=class extends xe{constructor(){super(),this.setAttribute("position",new At([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new At([0,2,0,0,2,0],2))}},oa=new Lr,ne=class{constructor(e){this._mesh=new Ct(oa,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,ra)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}}});var Re,Lt=A(()=>{B();Re=class extends Do{constructor(e){super(e);for(let t in this.uniforms)Object.defineProperty(this,t,{get(){return this.uniforms[t].value},set(r){this.uniforms[t].value=r}})}setDefine(e,t=void 0){t==null?e in this.defines&&(delete this.defines[e],this.needsUpdate=!0):this.defines[e]!==t&&(this.defines[e]=t,this.needsUpdate=!0)}}});var Gt,zo=A(()=>{B();Lt();Gt=class extends Re{constructor(e){super({blending:Oe,uniforms:{target1:{value:null},target2:{value:null},opacity:{value:1}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				uniform float opacity;

				uniform sampler2D target1;
				uniform sampler2D target2;

				varying vec2 vUv;

				void main() {

					vec4 color1 = texture2D( target1, vUv );
					vec4 color2 = texture2D( target2, vUv );

					float invOpacity = 1.0 - opacity;
					float totalAlpha = color1.a * invOpacity + color2.a * opacity;

					if ( color1.a != 0.0 || color2.a != 0.0 ) {

						gl_FragColor.rgb = color1.rgb * ( invOpacity * color1.a / totalAlpha ) + color2.rgb * ( opacity * color2.a / totalAlpha );
						gl_FragColor.a = totalAlpha;

					} else {

						gl_FragColor = vec4( 0.0 );

					}

				}`}),this.setValues(e)}}});function Nt(o=1){let e="uint";return o>1&&(e="uvec"+o),`
		${e} sobolReverseBits( ${e} x ) {

			x = ( ( ( x & 0xaaaaaaaau ) >> 1 ) | ( ( x & 0x55555555u ) << 1 ) );
			x = ( ( ( x & 0xccccccccu ) >> 2 ) | ( ( x & 0x33333333u ) << 2 ) );
			x = ( ( ( x & 0xf0f0f0f0u ) >> 4 ) | ( ( x & 0x0f0f0f0fu ) << 4 ) );
			x = ( ( ( x & 0xff00ff00u ) >> 8 ) | ( ( x & 0x00ff00ffu ) << 8 ) );
			return ( ( x >> 16 ) | ( x << 16 ) );

		}

		${e} sobolHashCombine( uint seed, ${e} v ) {

			return seed ^ ( v + ${e}( ( seed << 6 ) + ( seed >> 2 ) ) );

		}

		${e} sobolLaineKarrasPermutation( ${e} x, ${e} seed ) {

			x += seed;
			x ^= x * 0x6c50b47cu;
			x ^= x * 0xb82f1e52u;
			x ^= x * 0xc7afe638u;
			x ^= x * 0x8d22f6e6u;
			return x;

		}

		${e} nestedUniformScrambleBase2( ${e} x, ${e} seed ) {

			x = sobolLaineKarrasPermutation( x, seed );
			x = sobolReverseBits( x );
			return x;

		}
	`}function Ot(o=1){let e="uint",t="float",r="",s=".r",l="1u";return o>1&&(e="uvec"+o,t="vec"+o,r=o+"",o===2?(s=".rg",l="uvec2( 1u, 2u )"):o===3?(s=".rgb",l="uvec3( 1u, 2u, 3u )"):(s="",l="uvec4( 1u, 2u, 3u, 4u )")),`

		${t} sobol${r}( int effect ) {

			uint seed = sobolGetSeed( sobolBounceIndex, uint( effect ) );
			uint index = sobolPathIndex;

			uint shuffle_seed = sobolHashCombine( seed, 0u );
			uint shuffled_index = nestedUniformScrambleBase2( sobolReverseBits( index ), shuffle_seed );
			${t} sobol_pt = sobolGetTexturePoint( shuffled_index )${s};
			${e} result = ${e}( sobol_pt * 16777216.0 );

			${e} seed2 = sobolHashCombine( seed, ${l} );
			result = nestedUniformScrambleBase2( result, seed2 );

			return SOBOL_FACTOR * ${t}( result >> 8 );

		}
	`}var zt,Uo,ko,Gr=A(()=>{zt=`

	// Utils
	const float SOBOL_FACTOR = 1.0 / 16777216.0;
	const uint SOBOL_MAX_POINTS = 256u * 256u;

	${Nt(1)}
	${Nt(2)}
	${Nt(3)}
	${Nt(4)}

	uint sobolHash( uint x ) {

		// finalizer from murmurhash3
		x ^= x >> 16;
		x *= 0x85ebca6bu;
		x ^= x >> 13;
		x *= 0xc2b2ae35u;
		x ^= x >> 16;
		return x;

	}

`,Uo=`

	const uint SOBOL_DIRECTIONS_1[ 32 ] = uint[ 32 ](
		0x80000000u, 0xc0000000u, 0xa0000000u, 0xf0000000u,
		0x88000000u, 0xcc000000u, 0xaa000000u, 0xff000000u,
		0x80800000u, 0xc0c00000u, 0xa0a00000u, 0xf0f00000u,
		0x88880000u, 0xcccc0000u, 0xaaaa0000u, 0xffff0000u,
		0x80008000u, 0xc000c000u, 0xa000a000u, 0xf000f000u,
		0x88008800u, 0xcc00cc00u, 0xaa00aa00u, 0xff00ff00u,
		0x80808080u, 0xc0c0c0c0u, 0xa0a0a0a0u, 0xf0f0f0f0u,
		0x88888888u, 0xccccccccu, 0xaaaaaaaau, 0xffffffffu
	);

	const uint SOBOL_DIRECTIONS_2[ 32 ] = uint[ 32 ](
		0x80000000u, 0xc0000000u, 0x60000000u, 0x90000000u,
		0xe8000000u, 0x5c000000u, 0x8e000000u, 0xc5000000u,
		0x68800000u, 0x9cc00000u, 0xee600000u, 0x55900000u,
		0x80680000u, 0xc09c0000u, 0x60ee0000u, 0x90550000u,
		0xe8808000u, 0x5cc0c000u, 0x8e606000u, 0xc5909000u,
		0x6868e800u, 0x9c9c5c00u, 0xeeee8e00u, 0x5555c500u,
		0x8000e880u, 0xc0005cc0u, 0x60008e60u, 0x9000c590u,
		0xe8006868u, 0x5c009c9cu, 0x8e00eeeeu, 0xc5005555u
	);

	const uint SOBOL_DIRECTIONS_3[ 32 ] = uint[ 32 ](
		0x80000000u, 0xc0000000u, 0x20000000u, 0x50000000u,
		0xf8000000u, 0x74000000u, 0xa2000000u, 0x93000000u,
		0xd8800000u, 0x25400000u, 0x59e00000u, 0xe6d00000u,
		0x78080000u, 0xb40c0000u, 0x82020000u, 0xc3050000u,
		0x208f8000u, 0x51474000u, 0xfbea2000u, 0x75d93000u,
		0xa0858800u, 0x914e5400u, 0xdbe79e00u, 0x25db6d00u,
		0x58800080u, 0xe54000c0u, 0x79e00020u, 0xb6d00050u,
		0x800800f8u, 0xc00c0074u, 0x200200a2u, 0x50050093u
	);

	const uint SOBOL_DIRECTIONS_4[ 32 ] = uint[ 32 ](
		0x80000000u, 0x40000000u, 0x20000000u, 0xb0000000u,
		0xf8000000u, 0xdc000000u, 0x7a000000u, 0x9d000000u,
		0x5a800000u, 0x2fc00000u, 0xa1600000u, 0xf0b00000u,
		0xda880000u, 0x6fc40000u, 0x81620000u, 0x40bb0000u,
		0x22878000u, 0xb3c9c000u, 0xfb65a000u, 0xddb2d000u,
		0x78022800u, 0x9c0b3c00u, 0x5a0fb600u, 0x2d0ddb00u,
		0xa2878080u, 0xf3c9c040u, 0xdb65a020u, 0x6db2d0b0u,
		0x800228f8u, 0x400b3cdcu, 0x200fb67au, 0xb00ddb9du
	);

	uint getMaskedSobol( uint index, uint directions[ 32 ] ) {

		uint X = 0u;
		for ( int bit = 0; bit < 32; bit ++ ) {

			uint mask = ( index >> bit ) & 1u;
			X ^= mask * directions[ bit ];

		}
		return X;

	}

	vec4 generateSobolPoint( uint index ) {

		if ( index >= SOBOL_MAX_POINTS ) {

			return vec4( 0.0 );

		}

		// NOTEL this sobol "direction" is also available but we can't write out 5 components
		// uint x = index & 0x00ffffffu;
		uint x = sobolReverseBits( getMaskedSobol( index, SOBOL_DIRECTIONS_1 ) ) & 0x00ffffffu;
		uint y = sobolReverseBits( getMaskedSobol( index, SOBOL_DIRECTIONS_2 ) ) & 0x00ffffffu;
		uint z = sobolReverseBits( getMaskedSobol( index, SOBOL_DIRECTIONS_3 ) ) & 0x00ffffffu;
		uint w = sobolReverseBits( getMaskedSobol( index, SOBOL_DIRECTIONS_4 ) ) & 0x00ffffffu;

		return vec4( x, y, z, w ) * SOBOL_FACTOR;

	}

`,ko=`

	// Seeds
	uniform sampler2D sobolTexture;
	uint sobolPixelIndex = 0u;
	uint sobolPathIndex = 0u;
	uint sobolBounceIndex = 0u;

	uint sobolGetSeed( uint bounce, uint effect ) {

		return sobolHash(
			sobolHashCombine(
				sobolHashCombine(
					sobolHash( bounce ),
					sobolPixelIndex
				),
				effect
			)
		);

	}

	vec4 sobolGetTexturePoint( uint index ) {

		if ( index >= SOBOL_MAX_POINTS ) {

			index = index % SOBOL_MAX_POINTS;

		}

		uvec2 dim = uvec2( textureSize( sobolTexture, 0 ).xy );
		uint y = index / dim.x;
		uint x = index - y * dim.x;
		vec2 uv = vec2( x, y ) / vec2( dim );
		return texture( sobolTexture, uv );

	}

	${Ot(1)}
	${Ot(2)}
	${Ot(3)}
	${Ot(4)}

`});var Nr,Ut,Vo=A(()=>{B();Ue();Lt();Gr();Nr=class extends Re{constructor(){super({blending:Oe,uniforms:{resolution:{value:new Q}},vertexShader:`

				varying vec2 vUv;
				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}
			`,fragmentShader:`

				${zt}
				${Uo}

				varying vec2 vUv;
				uniform vec2 resolution;
				void main() {

					uint index = uint( gl_FragCoord.y ) * uint( resolution.x ) + uint( gl_FragCoord.x );
					gl_FragColor = generateSobolPoint( index );

				}
			`})}},Ut=class{generate(e,t=256){let r=new ze(t,t,{type:j,format:O,minFilter:te,magFilter:te,generateMipmaps:!1}),s=e.getRenderTarget();e.setRenderTarget(r);let l=new ne(new Nr);return l.material.resolution.set(t,t),l.render(e),e.setRenderTarget(s),l.dispose(),r}}});function*ia(){let{_renderer:o,_fsQuad:e,_blendQuad:t,_primaryTarget:r,_blendTargets:s,_sobolTarget:l,_subframe:n,alpha:i,camera:a,material:m}=this,u=new he,f=new he,c=t.material,[h,T]=s;for(;;){i?(c.opacity=this._opacityFactor/(this._samples+1),m.blending=Oe,m.opacity=1):(m.opacity=this._opacityFactor/(this._samples+1),m.blending=Mo);let[x,g,d,p]=n,b=r.width,v=r.height;m.resolution.set(b*d,v*p),m.sobolTexture=l.texture,m.seed++;let y=this.tiles.x||1,E=this.tiles.y||1,S=y*E,w=1/o.getPixelRatio();for(let R=0;R<E;R++)for(let M=0;M<y;M++){m.cameraWorldMatrix.copy(a.matrixWorld),m.invProjectionMatrix.copy(a.projectionMatrixInverse);let I=0;a.projectionMatrix.elements[15]>0&&(I=1),a.isEquirectCamera&&(I=2),m.setDefine("CAMERA_TYPE",I);let _=o.getRenderTarget(),F=o.autoClear,H=o.getScissorTest();o.getScissor(u),o.getViewport(f);let D=M,L=R;if(!this.stableTiles){let ce=this._currentTile%(y*E);D=ce%y,L=~~(ce/y),this._currentTile=ce+1}o.setRenderTarget(r),o.setScissorTest(!0),V.x=D*b/y,V.y=(E-L-1)*v/E,V.z=b/y,V.w=v/E,V.x=x*b+d*V.x,V.y=g*v+p*V.y,V.z=d*V.z,V.w=p*V.w,V.x=V.x,V.y=V.y,V.z=V.z,V.w=V.w,V.multiplyScalar(w).ceil(),ke.x=x*b,ke.y=g*v,ke.z=d*b,ke.w=p*v,ke.multiplyScalar(w).ceil(),o.setScissor(V),o.setViewport(ke),o.autoClear=!1,e.render(o),o.setViewport(f),o.setScissor(u),o.setScissorTest(H),o.setRenderTarget(_),o.autoClear=F,i&&(c.target1=h.texture,c.target2=r.texture,o.setRenderTarget(T),t.render(o),o.setRenderTarget(_)),this._samples+=1/S,M===y-1&&R===E-1&&(this._samples=Math.round(this._samples)),yield}[h,T]=[T,h]}}var V,ke,Wo,kt,qo=A(()=>{B();Ue();zo();Vo();V=new he,ke=new he;Wo=new fe,kt=class{get material(){return this._fsQuad.material}set material(e){this._fsQuad.material=e}get target(){return this._alpha?this._blendTargets[1]:this._primaryTarget}set alpha(e){this._alpha!==e&&(e||(this._blendTargets[0].dispose(),this._blendTargets[1].dispose()),this._alpha=e,this.reset())}get alpha(){return this._alpha}get samples(){return this._samples}constructor(e){this.camera=null,this.tiles=new Q(1,1),this.stableNoise=!1,this.stableTiles=!0,this._samples=0,this._subframe=new he(0,0,1,1),this._opacityFactor=1,this._renderer=e,this._alpha=!1,this._fsQuad=new ne(null),this._blendQuad=new ne(new Gt),this._task=null,this._currentTile=0,this._sobolTarget=new Ut().generate(e);let t=e.extensions.get("OES_texture_float_linear");this._primaryTarget=new ze(1,1,{format:O,type:t?j:ee}),this._blendTargets=[new ze(1,1,{format:O,type:t?j:ee}),new ze(1,1,{format:O,type:t?j:ee})]}setSize(e,t){e=Math.ceil(e),t=Math.ceil(t),!(this._primaryTarget.width===e&&this._primaryTarget.height===t)&&(this._primaryTarget.setSize(e,t),this._blendTargets[0].setSize(e,t),this._blendTargets[1].setSize(e,t),this.reset())}dispose(){this._primaryTarget.dispose(),this._blendTargets[0].dispose(),this._blendTargets[1].dispose(),this._sobolTarget.dispose(),this._fsQuad.dispose(),this._blendQuad.dispose(),this._task=null}reset(){let{_renderer:e,_primaryTarget:t,_blendTargets:r}=this,s=e.getRenderTarget(),l=e.getClearAlpha();e.getClearColor(Wo),e.setRenderTarget(t),e.setClearColor(0,0),e.clearColor(),e.setRenderTarget(r[0]),e.setClearColor(0,0),e.clearColor(),e.setRenderTarget(r[1]),e.setClearColor(0,0),e.clearColor(),e.setClearColor(Wo,l),e.setRenderTarget(s),this._samples=0,this._task=null,this.stableNoise&&(this.material.seed=0)}update(){this._task||(this._task=ia.call(this)),this._task.next()}}});var Xo,Vt,Or=A(()=>{Xo=Math.pow(2,-24),Vt=Symbol("SKIP_GENERATION")});function zr(o){return o.index?o.index.count:o.attributes.position.count}function de(o){return zr(o)/3}function Ur(o,e=ArrayBuffer){return o>65535?new Uint32Array(new e(4*o)):new Uint16Array(new e(2*o))}function Yo(o,e){if(!o.index){let t=o.attributes.position.count,r=e.useSharedArrayBuffer?SharedArrayBuffer:ArrayBuffer,s=Ur(t,r);o.setIndex(new Y(s,1));for(let l=0;l<t;l++)s[l]=l}}function kr(o){let e=de(o),t=o.drawRange,r=t.start/3,s=(t.start+t.count)/3,l=Math.max(0,r),n=Math.min(e,s)-l;return[{offset:Math.floor(l),count:Math.floor(n)}]}function Vr(o){if(!o.groups||!o.groups.length)return kr(o);let e=[],t=new Set,r=o.drawRange,s=r.start/3,l=(r.start+r.count)/3;for(let i of o.groups){let a=i.start/3,m=(i.start+i.count)/3;t.add(Math.max(s,a)),t.add(Math.min(l,m))}let n=Array.from(t.values()).sort((i,a)=>i-a);for(let i=0;i<n.length-1;i++){let a=n[i],m=n[i+1];e.push({offset:Math.floor(a),count:Math.floor(m-a)})}return e}function $o(o){if(o.groups.length===0)return!1;let e=de(o),t=Vr(o).sort((l,n)=>l.offset-n.offset),r=t[t.length-1];r.count=Math.min(e-r.offset,r.count);let s=0;return t.forEach(({count:l})=>s+=l),e!==s}var Ve=A(()=>{B()});function G(o,e,t){return t.min.x=e[o],t.min.y=e[o+1],t.min.z=e[o+2],t.max.x=e[o+3],t.max.y=e[o+4],t.max.z=e[o+5],t}function jo(o){o[0]=o[1]=o[2]=1/0,o[3]=o[4]=o[5]=-1/0}function Wr(o){let e=-1,t=-1/0;for(let r=0;r<3;r++){let s=o[r+3]-o[r];s>t&&(t=s,e=r)}return e}function qr(o,e){e.set(o)}function Xr(o,e,t){let r,s;for(let l=0;l<3;l++){let n=l+3;r=o[l],s=e[l],t[l]=r<s?r:s,r=o[n],s=e[n],t[n]=r>s?r:s}}function pt(o,e,t){for(let r=0;r<3;r++){let s=e[o+2*r],l=e[o+2*r+1],n=s-l,i=s+l;n<t[r]&&(t[r]=n),i>t[r+3]&&(t[r+3]=i)}}function We(o){let e=o[3]-o[0],t=o[4]-o[1],r=o[5]-o[2];return 2*(e*t+t*r+r*e)}var Te=A(()=>{});function Wt(o,e,t,r,s=null){let l=1/0,n=1/0,i=1/0,a=-1/0,m=-1/0,u=-1/0,f=1/0,c=1/0,h=1/0,T=-1/0,x=-1/0,g=-1/0,d=s!==null;for(let p=e*6,b=(e+t)*6;p<b;p+=6){let v=o[p+0],y=o[p+1],E=v-y,S=v+y;E<l&&(l=E),S>a&&(a=S),d&&v<f&&(f=v),d&&v>T&&(T=v);let w=o[p+2],R=o[p+3],M=w-R,I=w+R;M<n&&(n=M),I>m&&(m=I),d&&w<c&&(c=w),d&&w>x&&(x=w);let _=o[p+4],F=o[p+5],H=_-F,D=_+F;H<i&&(i=H),D>u&&(u=D),d&&_<h&&(h=_),d&&_>g&&(g=_)}r[0]=l,r[1]=n,r[2]=i,r[3]=a,r[4]=m,r[5]=u,d&&(s[0]=f,s[1]=c,s[2]=h,s[3]=T,s[4]=x,s[5]=g)}function Ko(o,e,t,r){let s=1/0,l=1/0,n=1/0,i=-1/0,a=-1/0,m=-1/0;for(let u=e*6,f=(e+t)*6;u<f;u+=6){let c=o[u+0];c<s&&(s=c),c>i&&(i=c);let h=o[u+2];h<l&&(l=h),h>a&&(a=h);let T=o[u+4];T<n&&(n=T),T>m&&(m=T)}r[0]=s,r[1]=l,r[2]=n,r[3]=i,r[4]=a,r[5]=m}function Qo(o,e){jo(e);let t=o.attributes.position,r=o.index?o.index.array:null,s=de(o),l=new Float32Array(s*6),n=t.normalized,i=t.array,a=t.offset||0,m=3;t.isInterleavedBufferAttribute&&(m=t.data.stride);let u=["getX","getY","getZ"];for(let f=0;f<s;f++){let c=f*3,h=f*6,T=c+0,x=c+1,g=c+2;r&&(T=r[T],x=r[x],g=r[g]),n||(T=T*m+a,x=x*m+a,g=g*m+a);for(let d=0;d<3;d++){let p,b,v;n?(p=t[u[d]](T),b=t[u[d]](x),v=t[u[d]](g)):(p=i[T+d],b=i[x+d],v=i[g+d]);let y=p;b<y&&(y=b),v<y&&(y=v);let E=p;b>E&&(E=b),v>E&&(E=v);let S=(E-y)/2,w=d*2;l[h+w+0]=y+S,l[h+w+1]=S+(Math.abs(y)+S)*Xo,y<e[d]&&(e[d]=y),E>e[d+3]&&(e[d+3]=E)}}return l}var Zo=A(()=>{Or();Te();Ve()});function ri(o,e,t,r,s,l){let n=-1,i=0;if(l===0)n=Wr(e),n!==-1&&(i=(e[n]+e[n+3])/2);else if(l===1)n=Wr(o),n!==-1&&(i=aa(t,r,s,n));else if(l===2){let a=We(o),m=1.25*s,u=r*6,f=(r+s)*6;for(let c=0;c<3;c++){let h=e[c],g=(e[c+3]-h)/be;if(s<be/4){let d=[...Se];d.length=s;let p=0;for(let v=u;v<f;v+=6,p++){let y=d[p];y.candidate=t[v+2*c],y.count=0;let{bounds:E,leftCacheBounds:S,rightCacheBounds:w}=y;for(let R=0;R<3;R++)w[R]=1/0,w[R+3]=-1/0,S[R]=1/0,S[R+3]=-1/0,E[R]=1/0,E[R+3]=-1/0;pt(v,t,E)}d.sort(na);let b=s;for(let v=0;v<b;v++){let y=d[v];for(;v+1<b&&d[v+1].candidate===y.candidate;)d.splice(v+1,1),b--}for(let v=u;v<f;v+=6){let y=t[v+2*c];for(let E=0;E<b;E++){let S=d[E];y>=S.candidate?pt(v,t,S.rightCacheBounds):(pt(v,t,S.leftCacheBounds),S.count++)}}for(let v=0;v<b;v++){let y=d[v],E=y.count,S=s-y.count,w=y.leftCacheBounds,R=y.rightCacheBounds,M=0;E!==0&&(M=We(w)/a);let I=0;S!==0&&(I=We(R)/a);let _=1+1.25*(M*E+I*S);_<m&&(n=c,m=_,i=y.candidate)}}else{for(let b=0;b<be;b++){let v=Se[b];v.count=0,v.candidate=h+g+b*g;let y=v.bounds;for(let E=0;E<3;E++)y[E]=1/0,y[E+3]=-1/0}for(let b=u;b<f;b+=6){let E=~~((t[b+2*c]-h)/g);E>=be&&(E=be-1);let S=Se[E];S.count++,pt(b,t,S.bounds)}let d=Se[be-1];qr(d.bounds,d.rightCacheBounds);for(let b=be-2;b>=0;b--){let v=Se[b],y=Se[b+1];Xr(v.bounds,y.rightCacheBounds,v.rightCacheBounds)}let p=0;for(let b=0;b<be-1;b++){let v=Se[b],y=v.count,E=v.bounds,w=Se[b+1].rightCacheBounds;y!==0&&(p===0?qr(E,qt):Xr(E,qt,qt)),p+=y;let R=0,M=0;p!==0&&(R=We(qt)/a);let I=s-p;I!==0&&(M=We(w)/a);let _=1+1.25*(R*p+M*I);_<m&&(n=c,m=_,i=v.candidate)}}}}else console.warn(`MeshBVH: Invalid build strategy value ${l} used.`);return{axis:n,pos:i}}function aa(o,e,t,r){let s=0;for(let l=e,n=e+t;l<n;l++)s+=o[l*6+r*2];return s/t}var be,na,Se,qt,oi=A(()=>{Te();be=32,na=(o,e)=>o.candidate-e.candidate,Se=new Array(be).fill().map(()=>({count:0,bounds:new Float32Array(6),rightCacheBounds:new Float32Array(6),leftCacheBounds:new Float32Array(6),candidate:0})),qt=new Float32Array(6)});var Ie,ii=A(()=>{Ie=class{constructor(){}}});function si(o,e,t,r,s,l){let n=r,i=r+s-1,a=l.pos,m=l.axis*2;for(;;){for(;n<=i&&t[n*6+m]<a;)n++;for(;n<=i&&t[i*6+m]>=a;)i--;if(n<i){for(let u=0;u<3;u++){let f=e[n*3+u];e[n*3+u]=e[i*3+u],e[i*3+u]=f}for(let u=0;u<6;u++){let f=t[n*6+u];t[n*6+u]=t[i*6+u],t[i*6+u]=f}n++,i--}else return n}}var ni=A(()=>{});function ai(o,e,t,r,s,l){let n=r,i=r+s-1,a=l.pos,m=l.axis*2;for(;;){for(;n<=i&&t[n*6+m]<a;)n++;for(;n<=i&&t[i*6+m]>=a;)i--;if(n<i){let u=o[n];o[n]=o[i],o[i]=u;for(let f=0;f<6;f++){let c=t[n*6+f];t[n*6+f]=t[i*6+f],t[i*6+f]=c}n++,i--}else return n}}var li=A(()=>{});function la(o,e){let t=(o.index?o.index.count:o.attributes.position.count)/3,r=t>2**16,s=r?4:2,l=e?new SharedArrayBuffer(t*s):new ArrayBuffer(t*s),n=r?new Uint32Array(l):new Uint16Array(l);for(let i=0,a=n.length;i<a;i++)n[i]=i;return n}function ca(o,e){let t=o.geometry,r=t.index?t.index.array:null,s=e.maxDepth,l=e.verbose,n=e.maxLeafTris,i=e.strategy,a=e.onProgress,m=de(t),u=o._indirectBuffer,f=!1,c=new Float32Array(6),h=new Float32Array(6),T=Qo(t,c),x=e.indirect?ai:si,g=[],d=e.indirect?kr(t):Vr(t);if(d.length===1){let v=d[0],y=new Ie;y.boundingData=c,Ko(T,v.offset,v.count,h),b(y,v.offset,v.count,h),g.push(y)}else for(let v of d){let y=new Ie;y.boundingData=new Float32Array(6),Wt(T,v.offset,v.count,y.boundingData,h),b(y,v.offset,v.count,h),g.push(y)}return g;function p(v){a&&a(v/m)}function b(v,y,E,S=null,w=0){if(!f&&w>=s&&(f=!0,l&&(console.warn(`MeshBVH: Max depth of ${s} reached when generating BVH. Consider increasing maxDepth.`),console.warn(t))),E<=n||w>=s)return p(y+E),v.offset=y,v.count=E,v;let R=ri(v.boundingData,S,T,y,E,i);if(R.axis===-1)return p(y+E),v.offset=y,v.count=E,v;let M=x(u,r,T,y,E,R);if(M===y||M===y+E)p(y+E),v.offset=y,v.count=E;else{v.splitAxis=R.axis;let I=new Ie,_=y,F=M-y;v.left=I,I.boundingData=new Float32Array(6),Wt(T,_,F,I.boundingData,h),b(I,_,F,h,w+1);let H=new Ie,D=M,L=E-F;v.right=H,H.boundingData=new Float32Array(6),Wt(T,D,L,H.boundingData,h),b(H,D,L,h,w+1)}return v}}function ci(o,e){let t=o.geometry;e.indirect&&(o._indirectBuffer=la(t,e.useSharedArrayBuffer),$o(t)&&!e.verbose&&console.warn('MeshBVH: Provided geometry contains groups that do not fully span the vertex contents while using the "indirect" option. BVH may incorrectly report intersections on unrendered portions of the geometry.')),o._indirectBuffer||Yo(t,e);let r=ca(o,e),s,l,n,i=[],a=e.useSharedArrayBuffer?SharedArrayBuffer:ArrayBuffer;for(let f=0;f<r.length;f++){let c=r[f],h=m(c),T=new a(32*h);s=new Float32Array(T),l=new Uint32Array(T),n=new Uint16Array(T),u(0,c),i.push(T)}o._roots=i;return;function m(f){return f.count?1:1+m(f.left)+m(f.right)}function u(f,c){let h=f/4,T=f/2,x=!!c.count,g=c.boundingData;for(let d=0;d<6;d++)s[h+d]=g[d];if(x){let d=c.offset,p=c.count;return l[h+6]=d,n[T+14]=p,n[T+15]=65535,f+32}else{let d=c.left,p=c.right,b=c.splitAxis,v;if(v=u(f+32,d),v/4>Math.pow(2,32))throw new Error("MeshBVH: Cannot store child pointer greater than 32 bits.");return l[h+6]=v/4,v=u(v,p),l[h+7]=b,v}}}var ui=A(()=>{Ve();Zo();oi();ii();ni();li()});var ie,ld,Yr=A(()=>{B();ie=class{constructor(){this.min=1/0,this.max=-1/0}setFromPointsField(e,t){let r=1/0,s=-1/0;for(let l=0,n=e.length;l<n;l++){let a=e[l][t];r=a<r?a:r,s=a>s?a:s}this.min=r,this.max=s}setFromPoints(e,t){let r=1/0,s=-1/0;for(let l=0,n=t.length;l<n;l++){let i=t[l],a=e.dot(i);r=a<r?a:r,s=a>s?a:s}this.min=r,this.max=s}isSeparated(e){return this.min>e.max||e.min>this.max}};ie.prototype.setFromBox=function(){let o=new C;return function(t,r){let s=r.min,l=r.max,n=1/0,i=-1/0;for(let a=0;a<=1;a++)for(let m=0;m<=1;m++)for(let u=0;u<=1;u++){o.x=s.x*a+l.x*(1-a),o.y=s.y*m+l.y*(1-m),o.z=s.z*u+l.z*(1-u);let f=t.dot(o);n=Math.min(f,n),i=Math.max(f,i)}this.min=n,this.max=i}}();ld=function(){let o=new ie;return function(t,r){let s=t.points,l=t.satAxes,n=t.satBounds,i=r.points,a=r.satAxes,m=r.satBounds;for(let u=0;u<3;u++){let f=n[u],c=l[u];if(o.setFromPoints(c,i),f.isSeparated(o))return!1}for(let u=0;u<3;u++){let f=m[u],c=a[u];if(o.setFromPoints(c,s),f.isSeparated(o))return!1}}}()});var ua,mt,fi,$r=A(()=>{B();ua=function(){let o=new C,e=new C,t=new C;return function(s,l,n){let i=s.start,a=o,m=l.start,u=e;t.subVectors(i,m),o.subVectors(s.end,s.start),e.subVectors(l.end,l.start);let f=t.dot(u),c=u.dot(a),h=u.dot(u),T=t.dot(a),g=a.dot(a)*h-c*c,d,p;g!==0?d=(f*c-T*h)/g:d=0,p=(f+d*c)/h,n.x=d,n.y=p}}(),mt=function(){let o=new Q,e=new C,t=new C;return function(s,l,n,i){ua(s,l,o);let a=o.x,m=o.y;if(a>=0&&a<=1&&m>=0&&m<=1){s.at(a,n),l.at(m,i);return}else if(a>=0&&a<=1){m<0?l.at(0,i):l.at(1,i),s.closestPointToPoint(i,!0,n);return}else if(m>=0&&m<=1){a<0?s.at(0,n):s.at(1,n),l.closestPointToPoint(n,!0,i);return}else{let u;a<0?u=s.start:u=s.end;let f;m<0?f=l.start:f=l.end;let c=e,h=t;if(s.closestPointToPoint(f,!0,e),l.closestPointToPoint(u,!0,t),c.distanceToSquared(f)<=h.distanceToSquared(u)){n.copy(c),i.copy(f);return}else{n.copy(u),i.copy(h);return}}}}(),fi=function(){let o=new C,e=new C,t=new Ht,r=new ae;return function(l,n){let{radius:i,center:a}=l,{a:m,b:u,c:f}=n;if(r.start=m,r.end=u,r.closestPointToPoint(a,!0,o).distanceTo(a)<=i||(r.start=m,r.end=f,r.closestPointToPoint(a,!0,o).distanceTo(a)<=i)||(r.start=u,r.end=f,r.closestPointToPoint(a,!0,o).distanceTo(a)<=i))return!0;let x=n.getPlane(t);if(Math.abs(x.distanceToPoint(a))<=i){let d=x.projectPoint(a,e);if(n.containsPoint(d))return!0}return!1}}()});function jr(o){return Math.abs(o)<fa}var fa,re,qe=A(()=>{B();Yr();$r();fa=1e-15;re=class extends Ee{constructor(...e){super(...e),this.isExtendedTriangle=!0,this.satAxes=new Array(4).fill().map(()=>new C),this.satBounds=new Array(4).fill().map(()=>new ie),this.points=[this.a,this.b,this.c],this.sphere=new Go,this.plane=new Ht,this.needsUpdate=!0}intersectsSphere(e){return fi(e,this)}update(){let e=this.a,t=this.b,r=this.c,s=this.points,l=this.satAxes,n=this.satBounds,i=l[0],a=n[0];this.getNormal(i),a.setFromPoints(i,s);let m=l[1],u=n[1];m.subVectors(e,t),u.setFromPoints(m,s);let f=l[2],c=n[2];f.subVectors(t,r),c.setFromPoints(f,s);let h=l[3],T=n[3];h.subVectors(r,e),T.setFromPoints(h,s),this.sphere.setFromPoints(this.points),this.plane.setFromNormalAndCoplanarPoint(i,e),this.needsUpdate=!1}};re.prototype.closestPointToSegment=function(){let o=new C,e=new C,t=new ae;return function(s,l=null,n=null){let{start:i,end:a}=s,m=this.points,u,f=1/0;for(let c=0;c<3;c++){let h=(c+1)%3;t.start.copy(m[c]),t.end.copy(m[h]),mt(t,s,o,e),u=o.distanceToSquared(e),u<f&&(f=u,l&&l.copy(o),n&&n.copy(e))}return this.closestPointToPoint(i,o),u=i.distanceToSquared(o),u<f&&(f=u,l&&l.copy(o),n&&n.copy(i)),this.closestPointToPoint(a,o),u=a.distanceToSquared(o),u<f&&(f=u,l&&l.copy(o),n&&n.copy(a)),Math.sqrt(f)}}();re.prototype.intersectsTriangle=function(){let o=new re,e=new Array(3),t=new Array(3),r=new ie,s=new ie,l=new C,n=new C,i=new C,a=new C,m=new C,u=new ae,f=new ae,c=new ae,h=new C;function T(x,g,d){let p=x.points,b=0,v=-1;for(let y=0;y<3;y++){let{start:E,end:S}=u;E.copy(p[y]),S.copy(p[(y+1)%3]),u.delta(n);let w=jr(g.distanceToPoint(E));if(jr(g.normal.dot(n))&&w){d.copy(u),b=2;break}let R=g.intersectLine(u,h);if(!R&&w&&h.copy(E),(R||w)&&!jr(h.distanceTo(S))){if(b<=1)(b===1?d.start:d.end).copy(h),w&&(v=b);else if(b>=2){(v===1?d.start:d.end).copy(h),b=2;break}if(b++,b===2&&v===-1)break}}return b}return function(g,d=null,p=!1){this.needsUpdate&&this.update(),g.isExtendedTriangle?g.needsUpdate&&g.update():(o.copy(g),o.update(),g=o);let b=this.plane,v=g.plane;if(Math.abs(b.normal.dot(v.normal))>1-1e-10){let y=this.satBounds,E=this.satAxes;t[0]=g.a,t[1]=g.b,t[2]=g.c;for(let R=0;R<4;R++){let M=y[R],I=E[R];if(r.setFromPoints(I,t),M.isSeparated(r))return!1}let S=g.satBounds,w=g.satAxes;e[0]=this.a,e[1]=this.b,e[2]=this.c;for(let R=0;R<4;R++){let M=S[R],I=w[R];if(r.setFromPoints(I,e),M.isSeparated(r))return!1}for(let R=0;R<4;R++){let M=E[R];for(let I=0;I<4;I++){let _=w[I];if(l.crossVectors(M,_),r.setFromPoints(l,e),s.setFromPoints(l,t),r.isSeparated(s))return!1}}return d&&(p||console.warn("ExtendedTriangle.intersectsTriangle: Triangles are coplanar which does not support an output edge. Setting edge to 0, 0, 0."),d.start.set(0,0,0),d.end.set(0,0,0)),!0}else{let y=T(this,v,f);if(y===1&&g.containsPoint(f.end))return d&&(d.start.copy(f.end),d.end.copy(f.end)),!0;if(y!==2)return!1;let E=T(g,b,c);if(E===1&&this.containsPoint(c.end))return d&&(d.start.copy(c.end),d.end.copy(c.end)),!0;if(E!==2)return!1;if(f.delta(i),c.delta(a),i.dot(a)<0){let F=c.start;c.start=c.end,c.end=F}let S=f.start.dot(i),w=f.end.dot(i),R=c.start.dot(i),M=c.end.dot(i),I=w<R,_=S<M;return S!==M&&R!==w&&I===_?!1:(d&&(m.subVectors(f.start,c.start),m.dot(i)>0?d.start.copy(f.start):d.start.copy(c.start),m.subVectors(f.end,c.end),m.dot(i)<0?d.end.copy(f.end):d.end.copy(c.end)),!0)}}}();re.prototype.distanceToPoint=function(){let o=new C;return function(t){return this.closestPointToPoint(t,o),t.distanceTo(o)}}();re.prototype.distanceToTriangle=function(){let o=new C,e=new C,t=["a","b","c"],r=new ae,s=new ae;return function(n,i=null,a=null){let m=i||a?r:null;if(this.intersectsTriangle(n,m))return(i||a)&&(i&&m.getCenter(i),a&&m.getCenter(a)),0;let u=1/0;for(let f=0;f<3;f++){let c,h=t[f],T=n[h];this.closestPointToPoint(T,o),c=T.distanceToSquared(o),c<u&&(u=c,i&&i.copy(o),a&&a.copy(T));let x=this[h];n.closestPointToPoint(x,o),c=x.distanceToSquared(o),c<u&&(u=c,i&&i.copy(x),a&&a.copy(o))}for(let f=0;f<3;f++){let c=t[f],h=t[(f+1)%3];r.set(this[c],this[h]);for(let T=0;T<3;T++){let x=t[T],g=t[(T+1)%3];s.set(n[x],n[g]),mt(r,s,o,e);let d=o.distanceToSquared(e);d<u&&(u=d,i&&i.copy(o),a&&a.copy(e))}}return Math.sqrt(u)}}()});var W,Be=A(()=>{B();Yr();qe();$r();W=class{constructor(e,t,r){this.isOrientedBox=!0,this.min=new C,this.max=new C,this.matrix=new z,this.invMatrix=new z,this.points=new Array(8).fill().map(()=>new C),this.satAxes=new Array(3).fill().map(()=>new C),this.satBounds=new Array(3).fill().map(()=>new ie),this.alignedSatBounds=new Array(3).fill().map(()=>new ie),this.needsUpdate=!1,e&&this.min.copy(e),t&&this.max.copy(t),r&&this.matrix.copy(r)}set(e,t,r){this.min.copy(e),this.max.copy(t),this.matrix.copy(r),this.needsUpdate=!0}copy(e){this.min.copy(e.min),this.max.copy(e.max),this.matrix.copy(e.matrix),this.needsUpdate=!0}};W.prototype.update=function(){return function(){let e=this.matrix,t=this.min,r=this.max,s=this.points;for(let m=0;m<=1;m++)for(let u=0;u<=1;u++)for(let f=0;f<=1;f++){let c=1*m|2*u|4*f,h=s[c];h.x=m?r.x:t.x,h.y=u?r.y:t.y,h.z=f?r.z:t.z,h.applyMatrix4(e)}let l=this.satBounds,n=this.satAxes,i=s[0];for(let m=0;m<3;m++){let u=n[m],f=l[m],c=1<<m,h=s[c];u.subVectors(i,h),f.setFromPoints(u,s)}let a=this.alignedSatBounds;a[0].setFromPointsField(s,"x"),a[1].setFromPointsField(s,"y"),a[2].setFromPointsField(s,"z"),this.invMatrix.copy(this.matrix).invert(),this.needsUpdate=!1}}();W.prototype.intersectsBox=function(){let o=new ie;return function(t){this.needsUpdate&&this.update();let r=t.min,s=t.max,l=this.satBounds,n=this.satAxes,i=this.alignedSatBounds;if(o.min=r.x,o.max=s.x,i[0].isSeparated(o)||(o.min=r.y,o.max=s.y,i[1].isSeparated(o))||(o.min=r.z,o.max=s.z,i[2].isSeparated(o)))return!1;for(let a=0;a<3;a++){let m=n[a],u=l[a];if(o.setFromBox(m,t),u.isSeparated(o))return!1}return!0}}();W.prototype.intersectsTriangle=function(){let o=new re,e=new Array(3),t=new ie,r=new ie,s=new C;return function(n){this.needsUpdate&&this.update(),n.isExtendedTriangle?n.needsUpdate&&n.update():(o.copy(n),o.update(),n=o);let i=this.satBounds,a=this.satAxes;e[0]=n.a,e[1]=n.b,e[2]=n.c;for(let c=0;c<3;c++){let h=i[c],T=a[c];if(t.setFromPoints(T,e),h.isSeparated(t))return!1}let m=n.satBounds,u=n.satAxes,f=this.points;for(let c=0;c<3;c++){let h=m[c],T=u[c];if(t.setFromPoints(T,f),h.isSeparated(t))return!1}for(let c=0;c<3;c++){let h=a[c];for(let T=0;T<4;T++){let x=u[T];if(s.crossVectors(h,x),t.setFromPoints(s,e),r.setFromPoints(s,f),t.isSeparated(r))return!1}}return!0}}();W.prototype.closestPointToPoint=function(){return function(e,t){return this.needsUpdate&&this.update(),t.copy(e).applyMatrix4(this.invMatrix).clamp(this.min,this.max).applyMatrix4(this.matrix),t}}();W.prototype.distanceToPoint=function(){let o=new C;return function(t){return this.closestPointToPoint(t,o),t.distanceTo(o)}}();W.prototype.distanceToBox=function(){let o=["x","y","z"],e=new Array(12).fill().map(()=>new ae),t=new Array(12).fill().map(()=>new ae),r=new C,s=new C;return function(n,i=0,a=null,m=null){if(this.needsUpdate&&this.update(),this.intersectsBox(n))return(a||m)&&(n.getCenter(s),this.closestPointToPoint(s,r),n.closestPointToPoint(r,s),a&&a.copy(r),m&&m.copy(s)),0;let u=i*i,f=n.min,c=n.max,h=this.points,T=1/0;for(let g=0;g<8;g++){let d=h[g];s.copy(d).clamp(f,c);let p=d.distanceToSquared(s);if(p<T&&(T=p,a&&a.copy(d),m&&m.copy(s),p<u))return Math.sqrt(p)}let x=0;for(let g=0;g<3;g++)for(let d=0;d<=1;d++)for(let p=0;p<=1;p++){let b=(g+1)%3,v=(g+2)%3,y=d<<b|p<<v,E=1<<g|d<<b|p<<v,S=h[y],w=h[E];e[x].set(S,w);let M=o[g],I=o[b],_=o[v],F=t[x],H=F.start,D=F.end;H[M]=f[M],H[I]=d?f[I]:c[I],H[_]=p?f[_]:c[I],D[M]=c[M],D[I]=d?f[I]:c[I],D[_]=p?f[_]:c[I],x++}for(let g=0;g<=1;g++)for(let d=0;d<=1;d++)for(let p=0;p<=1;p++){s.x=g?c.x:f.x,s.y=d?c.y:f.y,s.z=p?c.z:f.z,this.closestPointToPoint(s,r);let b=s.distanceToSquared(r);if(b<T&&(T=b,a&&a.copy(r),m&&m.copy(s),b<u))return Math.sqrt(b)}for(let g=0;g<12;g++){let d=e[g];for(let p=0;p<12;p++){let b=t[p];mt(d,b,r,s);let v=r.distanceToSquared(s);if(v<T&&(T=v,a&&a.copy(r),m&&m.copy(s),v<u))return Math.sqrt(v)}}return Math.sqrt(T)}}()});var we,Yt=A(()=>{we=class{constructor(e){this._getNewPrimitive=e,this._primitives=[]}getPrimitive(){let e=this._primitives;return e.length===0?this._getNewPrimitive():e.pop()}releasePrimitive(e){this._primitives.push(e)}}});var Kr,oe,$t=A(()=>{qe();Yt();Kr=class extends we{constructor(){super(()=>new re)}},oe=new Kr});function U(o,e){return e[o+15]===65535}function k(o,e){return e[o+6]}function q(o,e){return e[o+14]}function Z(o){return o+8}function $(o,e){return e[o+6]}function Xe(o,e){return e[o+7]}var ge=A(()=>{});var Qr,P,ve=A(()=>{Qr=class{constructor(){this.float32Array=null,this.uint16Array=null,this.uint32Array=null;let e=[],t=null;this.setBuffer=r=>{t&&e.push(t),t=r,this.float32Array=new Float32Array(r),this.uint16Array=new Uint16Array(r),this.uint32Array=new Uint32Array(r)},this.clearBuffer=()=>{t=null,this.float32Array=null,this.uint16Array=null,this.uint32Array=null,e.length!==0&&this.setBuffer(e.pop())}}},P=new Qr});function pi(o,e,t,r,s,l){Ae=jt.getPrimitive(),$e=jt.getPrimitive(),Ye.push(Ae,$e),P.setBuffer(o._roots[e]);let n=Zr(0,o.geometry,t,r,s,l);P.clearBuffer(),jt.releasePrimitive(Ae),jt.releasePrimitive($e),Ye.pop(),Ye.pop();let i=Ye.length;return i>0&&($e=Ye[i-1],Ae=Ye[i-2]),n}function Zr(o,e,t,r,s=null,l=0,n=0){let{float32Array:i,uint16Array:a,uint32Array:m}=P,u=o*2;if(U(u,a)){let c=k(o,m),h=q(u,a);return G(o,i,Ae),r(c,h,!1,n,l+o,Ae)}else{let M=function(_){let{uint16Array:F,uint32Array:H}=P,D=_*2;for(;!U(D,F);)_=Z(_),D=_*2;return k(_,H)},I=function(_){let{uint16Array:F,uint32Array:H}=P,D=_*2;for(;!U(D,F);)_=$(_,H),D=_*2;return k(_,H)+q(D,F)},c=Z(o),h=$(o,m),T=c,x=h,g,d,p,b;if(s&&(p=Ae,b=$e,G(T,i,p),G(x,i,b),g=s(p),d=s(b),d<g)){T=h,x=c;let _=g;g=d,d=_,p=b}p||(p=Ae,G(T,i,p));let v=U(T*2,a),y=t(p,v,g,n+1,l+T),E;if(y===2){let _=M(T),H=I(T)-_;E=r(_,H,!0,n+1,l+T,p)}else E=y&&Zr(T,e,t,r,s,l,n+1);if(E)return!0;b=$e,G(x,i,b);let S=U(x*2,a),w=t(b,S,d,n+1,l+x),R;if(w===2){let _=M(x),H=I(x)-_;R=r(_,H,!0,n+1,l+x,b)}else R=w&&Zr(x,e,t,r,s,l,n+1);return!!R}}var Ae,$e,Ye,jt,mi=A(()=>{B();Te();Yt();ge();ve();Ye=[],jt=new we(()=>new J)});function hi(o,e,t={},r=0,s=1/0){let l=r*r,n=s*s,i=1/0,a=null;if(o.shapecast({boundsTraverseOrder:u=>(ht.copy(e).clamp(u.min,u.max),ht.distanceToSquared(e)),intersectsBounds:(u,f,c)=>c<i&&c<n,intersectsTriangle:(u,f)=>{u.closestPointToPoint(e,ht);let c=e.distanceToSquared(ht);return c<i&&(Jr.copy(ht),i=c,a=f),c<l}}),i===1/0)return null;let m=Math.sqrt(i);return t.point?t.point.copy(Jr):t.point=Jr.clone(),t.distance=m,t.faceIndex=a,t}var ht,Jr,di=A(()=>{B();ht=new C,Jr=new C});function ma(o,e,t,r,s,l){let n;return l===St?n=o.intersectTriangle(r,t,e,!0,s):n=o.intersectTriangle(e,t,r,l!==wt,s),n===null?null:{distance:o.origin.distanceTo(s),point:s.clone()}}function ha(o,e,t,r,s,l,n,i,a){je.fromBufferAttribute(e,l),Ke.fromBufferAttribute(e,n),Qe.fromBufferAttribute(e,i);let m=ma(o,je,Ke,Qe,er,a);if(m){r&&(Qt.fromBufferAttribute(r,l),Zt.fromBufferAttribute(r,n),Jt.fromBufferAttribute(r,i),m.uv=Ee.getInterpolation(er,je,Ke,Qe,Qt,Zt,Jt,new Q)),s&&(Qt.fromBufferAttribute(s,l),Zt.fromBufferAttribute(s,n),Jt.fromBufferAttribute(s,i),m.uv1=Ee.getInterpolation(er,je,Ke,Qe,Qt,Zt,Jt,new Q)),t&&(gi.fromBufferAttribute(t,l),xi.fromBufferAttribute(t,n),Ti.fromBufferAttribute(t,i),m.normal=Ee.getInterpolation(er,je,Ke,Qe,gi,xi,Ti,new C),m.normal.dot(o.direction)>0&&m.normal.multiplyScalar(-1));let u={a:l,b:n,c:i,normal:new C,materialIndex:0};Ee.getNormal(je,Ke,Qe,u.normal),m.face=u,m.faceIndex=l}return m}function Ze(o,e,t,r,s){let l=r*3,n=l+0,i=l+1,a=l+2,m=o.index;o.index&&(n=m.getX(n),i=m.getX(i),a=m.getX(a));let{position:u,normal:f,uv:c,uv1:h}=o.attributes,T=ha(t,u,f,c,h,n,i,a,e);return T?(T.faceIndex=r,s&&s.push(T),T):null}var je,Ke,Qe,Qt,Zt,Jt,gi,xi,Ti,er,eo=A(()=>{B();je=new C,Ke=new C,Qe=new C,Qt=new Q,Zt=new Q,Jt=new Q,gi=new C,xi=new C,Ti=new C,er=new C});function N(o,e,t,r){let s=o.a,l=o.b,n=o.c,i=e,a=e+1,m=e+2;t&&(i=t.getX(i),a=t.getX(a),m=t.getX(m)),s.x=r.getX(i),s.y=r.getY(i),s.z=r.getZ(i),l.x=r.getX(a),l.y=r.getY(a),l.z=r.getZ(a),n.x=r.getX(m),n.y=r.getY(m),n.z=r.getZ(m)}var _e=A(()=>{B()});function bi(o,e,t,r,s,l){let{geometry:n,_indirectBuffer:i}=o;for(let a=r,m=r+s;a<m;a++)Ze(n,e,t,a,l)}function vi(o,e,t,r,s){let{geometry:l,_indirectBuffer:n}=o,i=1/0,a=null;for(let m=r,u=r+s;m<u;m++){let f;f=Ze(l,e,t,m),f&&f.distance<i&&(a=f,i=f.distance)}return a}function yi(o,e,t,r,s,l,n){let{geometry:i}=t,{index:a}=i,m=i.attributes.position;for(let u=o,f=e+o;u<f;u++){let c;if(c=u,N(n,c*3,a,m),n.needsUpdate=!0,r(n,c,s,l))return!0}return!1}var tr=A(()=>{eo();_e()});function Ei(o,e=null){e&&Array.isArray(e)&&(e=new Set(e));let t=o.geometry,r=t.index?t.index.array:null,s=t.attributes.position,l,n,i,a,m=0,u=o._roots;for(let c=0,h=u.length;c<h;c++)l=u[c],n=new Uint32Array(l),i=new Uint16Array(l),a=new Float32Array(l),f(0,m),m+=l.byteLength;function f(c,h,T=!1){let x=c*2;if(i[x+15]===65535){let d=n[c+6],p=i[x+14],b=1/0,v=1/0,y=1/0,E=-1/0,S=-1/0,w=-1/0;for(let R=3*d,M=3*(d+p);R<M;R++){let I=r[R],_=s.getX(I),F=s.getY(I),H=s.getZ(I);_<b&&(b=_),_>E&&(E=_),F<v&&(v=F),F>S&&(S=F),H<y&&(y=H),H>w&&(w=H)}return a[c+0]!==b||a[c+1]!==v||a[c+2]!==y||a[c+3]!==E||a[c+4]!==S||a[c+5]!==w?(a[c+0]=b,a[c+1]=v,a[c+2]=y,a[c+3]=E,a[c+4]=S,a[c+5]=w,!0):!1}else{let d=c+8,p=n[c+6],b=d+h,v=p+h,y=T,E=!1,S=!1;e?y||(E=e.has(b),S=e.has(v),y=!E&&!S):(E=!0,S=!0);let w=y||E,R=y||S,M=!1;w&&(M=f(d,h,y));let I=!1;R&&(I=f(p,h,y));let _=M||I;if(_)for(let F=0;F<3;F++){let H=d+F,D=p+F,L=a[H],ce=a[H+3],lt=a[D],ct=a[D+3];a[c+F]=L<lt?L:lt,a[c+F+3]=ce>ct?ce:ct}return _}}}var Ri=A(()=>{});function le(o,e,t,r){return G(o,e,Si),t.intersectBox(Si,r)}var Si,dt=A(()=>{B();Te();Si=new J});function wi(o,e,t,r,s,l){let{geometry:n,_indirectBuffer:i}=o;for(let a=r,m=r+s;a<m;a++){let u=i?i[a]:a;Ze(n,e,t,u,l)}}function Ai(o,e,t,r,s){let{geometry:l,_indirectBuffer:n}=o,i=1/0,a=null;for(let m=r,u=r+s;m<u;m++){let f;f=Ze(l,e,t,n?n[m]:m),f&&f.distance<i&&(a=f,i=f.distance)}return a}function _i(o,e,t,r,s,l,n){let{geometry:i}=t,{index:a}=i,m=i.attributes.position;for(let u=o,f=e+o;u<f;u++){let c;if(c=t.resolveTriangleIndex(u),N(n,c*3,a,m),n.needsUpdate=!0,r(n,c,s,l))return!0}return!1}var rr=A(()=>{eo();_e()});function Ci(o,e,t,r,s){P.setBuffer(o._roots[e]),to(0,o,t,r,s),P.clearBuffer()}function to(o,e,t,r,s){let{float32Array:l,uint16Array:n,uint32Array:i}=P,a=o*2;if(U(a,n)){let u=k(o,i),f=q(a,n);bi(e,t,r,u,f,s)}else{let u=Z(o);le(u,l,r,Mi)&&to(u,e,t,r,s);let f=$(o,i);le(f,l,r,Mi)&&to(f,e,t,r,s)}}var Mi,Fi=A(()=>{B();dt();ge();ve();tr();Mi=new C});function Hi(o,e,t,r){P.setBuffer(o._roots[e]);let s=ro(0,o,t,r);return P.clearBuffer(),s}function ro(o,e,t,r){let{float32Array:s,uint16Array:l,uint32Array:n}=P,i=o*2;if(U(i,l)){let m=k(o,n),u=q(i,l);return vi(e,t,r,m,u)}else{let m=Xe(o,n),u=da[m],c=r.direction[u]>=0,h,T;c?(h=Z(o),T=$(o,n)):(h=$(o,n),T=Z(o));let g=le(h,s,r,Ii)?ro(h,e,t,r):null;if(g){let b=g.point[u];if(c?b<=s[T+m]:b>=s[T+m+3])return g}let p=le(T,s,r,Ii)?ro(T,e,t,r):null;return g&&p?g.distance<=p.distance?g:p:g||p||null}}var Ii,da,Bi=A(()=>{B();ge();ve();dt();tr();Ii=new C,da=["x","y","z"]});function Pi(o,e,t,r){P.setBuffer(o._roots[e]);let s=oo(0,o,t,r);return P.clearBuffer(),s}function oo(o,e,t,r,s=null){let{float32Array:l,uint16Array:n,uint32Array:i}=P,a=o*2;if(s===null&&(t.boundingBox||t.computeBoundingBox(),Di.set(t.boundingBox.min,t.boundingBox.max,r),s=Di),U(a,n)){let u=e.geometry,f=u.index,c=u.attributes.position,h=t.index,T=t.attributes.position,x=k(o,i),g=q(a,n);if(gt.copy(r).invert(),t.boundsTree)return G(o,l,ir),ir.matrix.copy(gt),ir.needsUpdate=!0,t.boundsTree.shapecast({intersectsBounds:p=>ir.intersectsBox(p),intersectsTriangle:p=>{p.a.applyMatrix4(r),p.b.applyMatrix4(r),p.c.applyMatrix4(r),p.needsUpdate=!0;for(let b=x*3,v=(g+x)*3;b<v;b+=3)if(N(et,b,f,c),et.needsUpdate=!0,p.intersectsTriangle(et))return!0;return!1}});for(let d=x*3,p=(g+x)*3;d<p;d+=3){N(Je,d,f,c),Je.a.applyMatrix4(gt),Je.b.applyMatrix4(gt),Je.c.applyMatrix4(gt),Je.needsUpdate=!0;for(let b=0,v=h.count;b<v;b+=3)if(N(et,b,h,T),et.needsUpdate=!0,Je.intersectsTriangle(et))return!0}}else{let u=o+8,f=i[o+6];return G(u,l,or),!!(s.intersectsBox(or)&&oo(u,e,t,r,s)||(G(f,l,or),s.intersectsBox(or)&&oo(f,e,t,r,s)))}}var or,Je,et,gt,Di,ir,Li=A(()=>{B();Be();qe();_e();Te();ge();ve();or=new J,Je=new re,et=new re,gt=new z,Di=new W,ir=new W});function Gi(o,e,t,r={},s={},l=0,n=1/0){e.boundingBox||e.computeBoundingBox(),io.set(e.boundingBox.min,e.boundingBox.max,t),io.needsUpdate=!0;let i=o.geometry,a=i.attributes.position,m=i.index,u=e.attributes.position,f=e.index,c=oe.getPrimitive(),h=oe.getPrimitive(),T=ga,x=xa,g=null,d=null;s&&(g=Ta,d=ba);let p=1/0,b=null,v=null;return sr.copy(t).invert(),xt.matrix.copy(sr),o.shapecast({boundsTraverseOrder:y=>io.distanceToBox(y),intersectsBounds:(y,E,S)=>S<p&&S<n?(E&&(xt.min.copy(y.min),xt.max.copy(y.max),xt.needsUpdate=!0),!0):!1,intersectsRange:(y,E)=>{if(e.boundsTree)return e.boundsTree.shapecast({boundsTraverseOrder:w=>xt.distanceToBox(w),intersectsBounds:(w,R,M)=>M<p&&M<n,intersectsRange:(w,R)=>{for(let M=w,I=w+R;M<I;M++){N(h,3*M,f,u),h.a.applyMatrix4(t),h.b.applyMatrix4(t),h.c.applyMatrix4(t),h.needsUpdate=!0;for(let _=y,F=y+E;_<F;_++){N(c,3*_,m,a),c.needsUpdate=!0;let H=c.distanceToTriangle(h,T,g);if(H<p&&(x.copy(T),d&&d.copy(g),p=H,b=_,v=M),H<l)return!0}}}});{let S=de(e);for(let w=0,R=S;w<R;w++){N(h,3*w,f,u),h.a.applyMatrix4(t),h.b.applyMatrix4(t),h.c.applyMatrix4(t),h.needsUpdate=!0;for(let M=y,I=y+E;M<I;M++){N(c,3*M,m,a),c.needsUpdate=!0;let _=c.distanceToTriangle(h,T,g);if(_<p&&(x.copy(T),d&&d.copy(g),p=_,b=M,v=w),_<l)return!0}}}}}),oe.releasePrimitive(c),oe.releasePrimitive(h),p===1/0?null:(r.point?r.point.copy(x):r.point=x.clone(),r.distance=p,r.faceIndex=b,s&&(s.point?s.point.copy(d):s.point=d.clone(),s.point.applyMatrix4(sr),x.applyMatrix4(sr),s.distance=x.sub(s.point).length(),s.faceIndex=v),r)}var sr,io,xt,ga,xa,Ta,ba,Ni=A(()=>{B();Be();_e();Ve();$t();sr=new z,io=new W,xt=new W,ga=new C,xa=new C,Ta=new C,ba=new C});function Oi(o,e=null){e&&Array.isArray(e)&&(e=new Set(e));let t=o.geometry,r=t.index?t.index.array:null,s=t.attributes.position,l,n,i,a,m=0,u=o._roots;for(let c=0,h=u.length;c<h;c++)l=u[c],n=new Uint32Array(l),i=new Uint16Array(l),a=new Float32Array(l),f(0,m),m+=l.byteLength;function f(c,h,T=!1){let x=c*2;if(i[x+15]===65535){let d=n[c+6],p=i[x+14],b=1/0,v=1/0,y=1/0,E=-1/0,S=-1/0,w=-1/0;for(let R=d,M=d+p;R<M;R++){let I=3*o.resolveTriangleIndex(R);for(let _=0;_<3;_++){let F=I+_;F=r?r[F]:F;let H=s.getX(F),D=s.getY(F),L=s.getZ(F);H<b&&(b=H),H>E&&(E=H),D<v&&(v=D),D>S&&(S=D),L<y&&(y=L),L>w&&(w=L)}}return a[c+0]!==b||a[c+1]!==v||a[c+2]!==y||a[c+3]!==E||a[c+4]!==S||a[c+5]!==w?(a[c+0]=b,a[c+1]=v,a[c+2]=y,a[c+3]=E,a[c+4]=S,a[c+5]=w,!0):!1}else{let d=c+8,p=n[c+6],b=d+h,v=p+h,y=T,E=!1,S=!1;e?y||(E=e.has(b),S=e.has(v),y=!E&&!S):(E=!0,S=!0);let w=y||E,R=y||S,M=!1;w&&(M=f(d,h,y));let I=!1;R&&(I=f(p,h,y));let _=M||I;if(_)for(let F=0;F<3;F++){let H=d+F,D=p+F,L=a[H],ce=a[H+3],lt=a[D],ct=a[D+3];a[c+F]=L<lt?L:lt,a[c+F+3]=ce>ct?ce:ct}return _}}}var zi=A(()=>{});function ki(o,e,t,r,s){P.setBuffer(o._roots[e]),so(0,o,t,r,s),P.clearBuffer()}function so(o,e,t,r,s){let{float32Array:l,uint16Array:n,uint32Array:i}=P,a=o*2;if(U(a,n)){let u=k(o,i),f=q(a,n);wi(e,t,r,u,f,s)}else{let u=Z(o);le(u,l,r,Ui)&&so(u,e,t,r,s);let f=$(o,i);le(f,l,r,Ui)&&so(f,e,t,r,s)}}var Ui,Vi=A(()=>{B();dt();ge();ve();rr();Ui=new C});function qi(o,e,t,r){P.setBuffer(o._roots[e]);let s=no(0,o,t,r);return P.clearBuffer(),s}function no(o,e,t,r){let{float32Array:s,uint16Array:l,uint32Array:n}=P,i=o*2;if(U(i,l)){let m=k(o,n),u=q(i,l);return Ai(e,t,r,m,u)}else{let m=Xe(o,n),u=va[m],c=r.direction[u]>=0,h,T;c?(h=Z(o),T=$(o,n)):(h=$(o,n),T=Z(o));let g=le(h,s,r,Wi)?no(h,e,t,r):null;if(g){let b=g.point[u];if(c?b<=s[T+m]:b>=s[T+m+3])return g}let p=le(T,s,r,Wi)?no(T,e,t,r):null;return g&&p?g.distance<=p.distance?g:p:g||p||null}}var Wi,va,Xi=A(()=>{B();ge();ve();dt();rr();Wi=new C,va=["x","y","z"]});function $i(o,e,t,r){P.setBuffer(o._roots[e]);let s=ao(0,o,t,r);return P.clearBuffer(),s}function ao(o,e,t,r,s=null){let{float32Array:l,uint16Array:n,uint32Array:i}=P,a=o*2;if(s===null&&(t.boundingBox||t.computeBoundingBox(),Yi.set(t.boundingBox.min,t.boundingBox.max,r),s=Yi),U(a,n)){let u=e.geometry,f=u.index,c=u.attributes.position,h=t.index,T=t.attributes.position,x=k(o,i),g=q(a,n);if(Tt.copy(r).invert(),t.boundsTree)return G(o,l,ar),ar.matrix.copy(Tt),ar.needsUpdate=!0,t.boundsTree.shapecast({intersectsBounds:p=>ar.intersectsBox(p),intersectsTriangle:p=>{p.a.applyMatrix4(r),p.b.applyMatrix4(r),p.c.applyMatrix4(r),p.needsUpdate=!0;for(let b=x,v=g+x;b<v;b++)if(N(rt,3*e.resolveTriangleIndex(b),f,c),rt.needsUpdate=!0,p.intersectsTriangle(rt))return!0;return!1}});for(let d=x,p=g+x;d<p;d++){let b=e.resolveTriangleIndex(d);N(tt,3*b,f,c),tt.a.applyMatrix4(Tt),tt.b.applyMatrix4(Tt),tt.c.applyMatrix4(Tt),tt.needsUpdate=!0;for(let v=0,y=h.count;v<y;v+=3)if(N(rt,v,h,T),rt.needsUpdate=!0,tt.intersectsTriangle(rt))return!0}}else{let u=o+8,f=i[o+6];return G(u,l,nr),!!(s.intersectsBox(nr)&&ao(u,e,t,r,s)||(G(f,l,nr),s.intersectsBox(nr)&&ao(f,e,t,r,s)))}}var nr,tt,rt,Tt,Yi,ar,ji=A(()=>{B();Be();qe();_e();Te();ge();ve();nr=new J,tt=new re,rt=new re,Tt=new z,Yi=new W,ar=new W});function Ki(o,e,t,r={},s={},l=0,n=1/0){e.boundingBox||e.computeBoundingBox(),lo.set(e.boundingBox.min,e.boundingBox.max,t),lo.needsUpdate=!0;let i=o.geometry,a=i.attributes.position,m=i.index,u=e.attributes.position,f=e.index,c=oe.getPrimitive(),h=oe.getPrimitive(),T=ya,x=Ea,g=null,d=null;s&&(g=Ra,d=Sa);let p=1/0,b=null,v=null;return lr.copy(t).invert(),bt.matrix.copy(lr),o.shapecast({boundsTraverseOrder:y=>lo.distanceToBox(y),intersectsBounds:(y,E,S)=>S<p&&S<n?(E&&(bt.min.copy(y.min),bt.max.copy(y.max),bt.needsUpdate=!0),!0):!1,intersectsRange:(y,E)=>{if(e.boundsTree){let S=e.boundsTree;return S.shapecast({boundsTraverseOrder:w=>bt.distanceToBox(w),intersectsBounds:(w,R,M)=>M<p&&M<n,intersectsRange:(w,R)=>{for(let M=w,I=w+R;M<I;M++){let _=S.resolveTriangleIndex(M);N(h,3*_,f,u),h.a.applyMatrix4(t),h.b.applyMatrix4(t),h.c.applyMatrix4(t),h.needsUpdate=!0;for(let F=y,H=y+E;F<H;F++){let D=o.resolveTriangleIndex(F);N(c,3*D,m,a),c.needsUpdate=!0;let L=c.distanceToTriangle(h,T,g);if(L<p&&(x.copy(T),d&&d.copy(g),p=L,b=F,v=M),L<l)return!0}}}})}else{let S=de(e);for(let w=0,R=S;w<R;w++){N(h,3*w,f,u),h.a.applyMatrix4(t),h.b.applyMatrix4(t),h.c.applyMatrix4(t),h.needsUpdate=!0;for(let M=y,I=y+E;M<I;M++){let _=o.resolveTriangleIndex(M);N(c,3*_,m,a),c.needsUpdate=!0;let F=c.distanceToTriangle(h,T,g);if(F<p&&(x.copy(T),d&&d.copy(g),p=F,b=M,v=w),F<l)return!0}}}}}),oe.releasePrimitive(c),oe.releasePrimitive(h),p===1/0?null:(r.point?r.point.copy(x):r.point=x.clone(),r.distance=p,r.faceIndex=b,s&&(s.point?s.point.copy(d):s.point=d.clone(),s.point.applyMatrix4(lr),x.applyMatrix4(lr),s.distance=x.sub(s.point).length(),s.faceIndex=v),r)}var lr,lo,bt,ya,Ea,Ra,Sa,Qi=A(()=>{B();Be();_e();Ve();$t();lr=new z,lo=new W,bt=new W,ya=new C,Ea=new C,Ra=new C,Sa=new C});function Zi(){return typeof SharedArrayBuffer!="undefined"}var Ji=A(()=>{});function es(o,e,t,r){if(fo)throw new Error("MeshBVH: Recursive calls to bvhcast not supported.");fo=!0;let s=o._roots,l=e._roots,n,i=0,a=0,m=new z().copy(t).invert();for(let u=0,f=s.length;u<f;u++){vt.setBuffer(s[u]),a=0;let c=Me.getPrimitive();G(0,vt.float32Array,c),c.applyMatrix4(m);for(let h=0,T=l.length;h<T&&(cr.setBuffer(l[u]),n=pe(0,0,t,m,r,i,a,0,0,c),cr.clearBuffer(),a+=l[h].length,!n);h++);if(Me.releasePrimitive(c),vt.clearBuffer(),i+=s[u].length,n)break}return fo=!1,n}function pe(o,e,t,r,s,l=0,n=0,i=0,a=0,m=null,u=!1){let f,c;u?(f=cr,c=vt):(f=vt,c=cr);let h=f.float32Array,T=f.uint32Array,x=f.uint16Array,g=c.float32Array,d=c.uint32Array,p=c.uint16Array,b=o*2,v=e*2,y=U(b,x),E=U(v,p),S=!1;if(E&&y)u?S=s(k(e,d),q(e*2,p),k(o,T),q(o*2,x),a,n+e,i,l+o):S=s(k(o,T),q(o*2,x),k(e,d),q(e*2,p),i,l+o,a,n+e);else if(E){let w=Me.getPrimitive();G(e,g,w),w.applyMatrix4(t);let R=Z(o),M=$(o,T);G(R,h,ot),G(M,h,it);let I=w.intersectsBox(ot),_=w.intersectsBox(it);S=I&&pe(e,R,r,t,s,n,l,a,i+1,w,!u)||_&&pe(e,M,r,t,s,n,l,a,i+1,w,!u),Me.releasePrimitive(w)}else{let w=Z(e),R=$(e,d);G(w,g,co),G(R,g,uo);let M=m.intersectsBox(co),I=m.intersectsBox(uo);if(M&&I)S=pe(o,w,t,r,s,l,n,i,a+1,m,u)||pe(o,R,t,r,s,l,n,i,a+1,m,u);else if(M)if(y)S=pe(o,w,t,r,s,l,n,i,a+1,m,u);else{let _=Me.getPrimitive();_.copy(co).applyMatrix4(t);let F=Z(o),H=$(o,T);G(F,h,ot),G(H,h,it);let D=_.intersectsBox(ot),L=_.intersectsBox(it);S=D&&pe(w,F,r,t,s,n,l,a,i+1,_,!u)||L&&pe(w,H,r,t,s,n,l,a,i+1,_,!u),Me.releasePrimitive(_)}else if(I)if(y)S=pe(o,R,t,r,s,l,n,i,a+1,m,u);else{let _=Me.getPrimitive();_.copy(uo).applyMatrix4(t);let F=Z(o),H=$(o,T);G(F,h,ot),G(H,h,it);let D=_.intersectsBox(ot),L=_.intersectsBox(it);S=D&&pe(R,F,r,t,s,n,l,a,i+1,_,!u)||L&&pe(R,H,r,t,s,n,l,a,i+1,_,!u),Me.releasePrimitive(_)}}return S}var vt,cr,Me,ot,it,co,uo,fo,ts=A(()=>{B();ve();ge();Te();Yt();vt=new P.constructor,cr=new P.constructor,Me=new we(()=>new J),ot=new J,it=new J,co=new J,uo=new J,fo=!1});var ur,rs,yt,os=A(()=>{B();Or();ui();Be();Te();$t();mi();di();tr();Ri();Fi();Bi();Li();Ni();rr();zi();Vi();Xi();ji();Qi();Ji();_e();ts();ur=new W,rs=new J,yt=class o{static serialize(e,t={}){t={cloneBuffers:!0,...t};let r=e.geometry,s=e._roots,l=e._indirectBuffer,n=r.getIndex(),i;return t.cloneBuffers?i={roots:s.map(a=>a.slice()),index:n.array.slice(),indirectBuffer:l?l.slice():null}:i={roots:s,index:n.array,indirectBuffer:l},i}static deserialize(e,t,r={}){r={setIndex:!0,indirect:!!e.indirectBuffer,...r};let{index:s,roots:l,indirectBuffer:n}=e,i=new o(t,{...r,[Vt]:!0});if(i._roots=l,i._indirectBuffer=n||null,r.setIndex){let a=t.getIndex();if(a===null){let m=new Y(e.index,1,!1);t.setIndex(m)}else a.array!==s&&(a.array.set(s),a.needsUpdate=!0)}return i}get indirect(){return!!this._indirectBuffer}constructor(e,t={}){if(e.isBufferGeometry){if(e.index&&e.index.isInterleavedBufferAttribute)throw new Error("MeshBVH: InterleavedBufferAttribute is not supported for the index attribute.")}else throw new Error("MeshBVH: Only BufferGeometries are supported.");if(t=Object.assign({strategy:0,maxDepth:40,maxLeafTris:10,verbose:!0,useSharedArrayBuffer:!1,setBoundingBox:!0,onProgress:null,indirect:!1,[Vt]:!1},t),t.useSharedArrayBuffer&&!Zi())throw new Error("MeshBVH: SharedArrayBuffer is not available.");this.geometry=e,this._roots=null,this._indirectBuffer=null,t[Vt]||(ci(this,t),!e.boundingBox&&t.setBoundingBox&&(e.boundingBox=this.getBoundingBox(new J)));let{_indirectBuffer:r}=this;this.resolveTriangleIndex=t.indirect?s=>r[s]:s=>s}refit(e=null){return(this.indirect?Oi:Ei)(this,e)}traverse(e,t=0){let r=this._roots[t],s=new Uint32Array(r),l=new Uint16Array(r);n(0);function n(i,a=0){let m=i*2,u=l[m+15]===65535;if(u){let f=s[i+6],c=l[m+14];e(a,u,new Float32Array(r,i*4,6),f,c)}else{let f=i+32/4,c=s[i+6],h=s[i+7];e(a,u,new Float32Array(r,i*4,6),h)||(n(f,a+1),n(c,a+1))}}}raycast(e,t=ut){let r=this._roots,s=this.geometry,l=[],n=t.isMaterial,i=Array.isArray(t),a=s.groups,m=n?t.side:t,u=this.indirect?ki:Ci;for(let f=0,c=r.length;f<c;f++){let h=i?t[a[f].materialIndex].side:m,T=l.length;if(u(this,f,h,e,l),i){let x=a[f].materialIndex;for(let g=T,d=l.length;g<d;g++)l[g].face.materialIndex=x}}return l}raycastFirst(e,t=ut){let r=this._roots,s=this.geometry,l=t.isMaterial,n=Array.isArray(t),i=null,a=s.groups,m=l?t.side:t,u=this.indirect?qi:Hi;for(let f=0,c=r.length;f<c;f++){let h=n?t[a[f].materialIndex].side:m,T=u(this,f,h,e);T!=null&&(i==null||T.distance<i.distance)&&(i=T,n&&(T.face.materialIndex=a[f].materialIndex))}return i}intersectsGeometry(e,t){let r=!1,s=this._roots,l=this.indirect?$i:Pi;for(let n=0,i=s.length;n<i&&(r=l(this,n,e,t),!r);n++);return r}shapecast(e){let t=oe.getPrimitive(),r=this.indirect?_i:yi,{boundsTraverseOrder:s,intersectsBounds:l,intersectsRange:n,intersectsTriangle:i}=e;if(n&&i){let f=n;n=(c,h,T,x,g)=>f(c,h,T,x,g)?!0:r(c,h,this,i,T,x,t)}else n||(i?n=(f,c,h,T)=>r(f,c,this,i,h,T,t):n=(f,c,h)=>h);let a=!1,m=0,u=this._roots;for(let f=0,c=u.length;f<c;f++){let h=u[f];if(a=pi(this,f,l,n,s,m),a)break;m+=h.byteLength}return oe.releasePrimitive(t),a}bvhcast(e,t,r){let{intersectsRanges:s,intersectsTriangles:l}=r,n=oe.getPrimitive(),i=this.geometry.index,a=this.geometry.attributes.position,m=this.indirect?T=>{let x=this.resolveTriangleIndex(T);N(n,x*3,i,a)}:T=>{N(n,T*3,i,a)},u=oe.getPrimitive(),f=e.geometry.index,c=e.geometry.attributes.position,h=e.indirect?T=>{let x=e.resolveTriangleIndex(T);N(u,x*3,f,c)}:T=>{N(u,T*3,f,c)};if(l){let T=(x,g,d,p,b,v,y,E)=>{for(let S=d,w=d+p;S<w;S++){h(S),u.a.applyMatrix4(t),u.b.applyMatrix4(t),u.c.applyMatrix4(t),u.needsUpdate=!0;for(let R=x,M=x+g;R<M;R++)if(m(R),n.needsUpdate=!0,l(n,u,R,S,b,v,y,E))return!0}return!1};if(s){let x=s;s=function(g,d,p,b,v,y,E,S){return x(g,d,p,b,v,y,E,S)?!0:T(g,d,p,b,v,y,E,S)}}else s=T}return es(this,e,t,s)}intersectsBox(e,t){return ur.set(e.min,e.max,t),ur.needsUpdate=!0,this.shapecast({intersectsBounds:r=>ur.intersectsBox(r),intersectsTriangle:r=>ur.intersectsTriangle(r)})}intersectsSphere(e){return this.shapecast({intersectsBounds:t=>e.intersectsBox(t),intersectsTriangle:t=>t.intersectsSphere(e)})}closestPointToGeometry(e,t,r={},s={},l=0,n=1/0){return(this.indirect?Ki:Gi)(this,e,t,r,s,l,n)}closestPointToPoint(e,t={},r=0,s=1/0){return hi(this,e,t,r,s)}getBoundingBox(e){return e.makeEmpty(),this._roots.forEach(r=>{G(0,new Float32Array(r),rs),e.union(rs)}),e}}});function wa(o){switch(o){case 1:return"R";case 2:return"RG";case 3:return"RGBA";case 4:return"RGBA"}throw new Error}function Aa(o){switch(o){case 1:return ye;case 2:return Ho;case 3:return O;case 4:return O}}function is(o){switch(o){case 1:return Bo;case 2:return Dt;case 3:return Bt;case 4:return Bt}}var fr,st,nt,po=A(()=>{B();fr=class extends K{constructor(){super(),this.minFilter=te,this.magFilter=te,this.generateMipmaps=!1,this.overrideItemSize=null,this._forcedType=null}updateFrom(e){let t=this.overrideItemSize,r=e.itemSize,s=e.count;if(t!==null){if(r*s%t!==0)throw new Error("VertexAttributeTexture: overrideItemSize must divide evenly into buffer length.");e.itemSize=t,e.count=s*r/t}let l=e.itemSize,n=e.count,i=e.normalized,a=e.array.constructor,m=a.BYTES_PER_ELEMENT,u=this._forcedType,f=l;if(u===null)switch(a){case Float32Array:u=j;break;case Uint8Array:case Uint16Array:case Uint32Array:u=Fe;break;case Int8Array:case Int16Array:case Int32Array:u=_t;break}let c,h,T,x,g=wa(l);switch(u){case j:T=1,h=Aa(l),i&&m===1?(x=a,g+="8",a===Uint8Array?c=ft:(c=Pr,g+="_SNORM")):(x=Float32Array,g+="32F",c=j);break;case _t:g+=m*8+"I",T=i?Math.pow(2,a.BYTES_PER_ELEMENT*8-1):1,h=is(l),m===1?(x=Int8Array,c=Pr):m===2?(x=Int16Array,c=Po):(x=Int32Array,c=_t);break;case Fe:g+=m*8+"UI",T=i?Math.pow(2,a.BYTES_PER_ELEMENT*8-1):1,h=is(l),m===1?(x=Uint8Array,c=ft):m===2?(x=Uint16Array,c=Oo):(x=Uint32Array,c=Fe);break}f===3&&(h===O||h===Bt)&&(f=4);let d=Math.ceil(Math.sqrt(n)),p=f*d*d,b=new x(p),v=e.normalized;e.normalized=!1;for(let y=0;y<n;y++){let E=f*y;b[E]=e.getX(y)/T,l>=2&&(b[E+1]=e.getY(y)/T),l>=3&&(b[E+2]=e.getZ(y)/T,f===4&&(b[E+3]=1)),l>=4&&(b[E+3]=e.getW(y)/T)}e.normalized=v,this.internalFormat=g,this.format=h,this.type=c,this.image.width=d,this.image.height=d,this.image.data=b,this.needsUpdate=!0,this.dispose(),e.itemSize=r,e.count=s}},st=class extends fr{constructor(){super(),this._forcedType=Fe}},nt=class extends fr{constructor(){super(),this._forcedType=j}}});function _a(o,e,t){let r=t.array,s=o.index?o.index.array:null;for(let l=0,n=e.length;l<n;l++){let i=3*l,a=3*e[l];for(let m=0;m<3;m++)r[i+m]=s?s[a+m]:a+m}}function Ma(o,e,t){let r=o._roots;if(r.length!==1)throw new Error("MeshBVHUniformStruct: Multi-root BVHs not supported.");let s=r[0],l=new Uint16Array(s),n=new Uint32Array(s),i=new Float32Array(s),a=s.byteLength/32,m=2*Math.ceil(Math.sqrt(a/2)),u=new Float32Array(4*m*m),f=Math.ceil(Math.sqrt(a)),c=new Uint32Array(2*f*f);for(let h=0;h<a;h++){let T=h*32/4,x=T*2,g=T;for(let d=0;d<3;d++)u[8*h+0+d]=i[g+0+d],u[8*h+4+d]=i[g+3+d];if(U(x,l)){let d=q(x,l),p=k(T,n),b=4294901760|d;c[h*2+0]=b,c[h*2+1]=p}else{let d=4*$(T,n)/32,p=Xe(T,n);c[h*2+0]=p,c[h*2+1]=d}}e.image.data=u,e.image.width=m,e.image.height=m,e.format=O,e.type=j,e.internalFormat="RGBA32F",e.minFilter=te,e.magFilter=te,e.generateMipmaps=!1,e.needsUpdate=!0,e.dispose(),t.image.data=c,t.image.width=f,t.image.height=f,t.format=Dt,t.type=Fe,t.internalFormat="RG32UI",t.minFilter=te,t.magFilter=te,t.generateMipmaps=!1,t.needsUpdate=!0,t.dispose()}var pr,ss=A(()=>{B();po();ge();Ve();pr=class{constructor(){this.index=new st,this.position=new nt,this.bvhBounds=new K,this.bvhContents=new K,this._cachedIndexAttr=null,this.index.overrideItemSize=3}updateFrom(e){let{geometry:t}=e;if(Ma(e,this.bvhBounds,this.bvhContents),this.position.updateFrom(t.attributes.position),e.indirect){let r=e._indirectBuffer;if(this._cachedIndexAttr===null||this._cachedIndexAttr.count!==r.length)if(t.index)this._cachedIndexAttr=t.index.clone();else{let s=Ur(zr(t));this._cachedIndexAttr=new Y(s,1,!1)}_a(t,r,this._cachedIndexAttr),this.index.updateFrom(this._cachedIndexAttr)}else this.index.updateFrom(t.index)}dispose(){let{index:e,position:t,bvhBounds:r,bvhContents:s}=this;e&&e.dispose(),t&&t.dispose(),r&&r.dispose(),s&&s.dispose()}}});function Et(o,e){if(!o&&!e)return;let t=o.count===e.count,r=o.normalized===e.normalized,s=o.array.constructor===e.array.constructor,l=o.itemSize===e.itemSize;if(!t||!r||!s||!l)throw new Error}function Rt(o,e=null){let t=o.array.constructor,r=o.normalized,s=o.itemSize,l=e===null?o.count:e;return new Y(new t(s*l),s,r)}function fs(o,e,t=0){if(o.isInterleavedBufferAttribute){let r=o.itemSize;for(let s=0,l=o.count;s<l;s++){let n=s+t;e.setX(n,o.getX(s)),r>=2&&e.setY(n,o.getY(s)),r>=3&&e.setZ(n,o.getZ(s)),r>=4&&e.setW(n,o.getW(s))}}else{let r=e.array,s=r.constructor,l=r.BYTES_PER_ELEMENT*o.itemSize*t;new s(r.buffer,l,o.array.length).set(o.array)}}function Ca(o,e,t){let r=o.elements,s=e.elements;for(let l=0,n=s.length;l<n;l++)r[l]+=s[l]*t}function us(o,e,t){let r=o.skeleton,s=o.geometry,l=r.bones,n=r.boneInverses;as.fromBufferAttribute(s.attributes.skinIndex,e),ls.fromBufferAttribute(s.attributes.skinWeight,e),hr.elements.fill(0);for(let i=0;i<4;i++){let a=ls.getComponent(i);if(a!==0){let m=as.getComponent(i);cs.multiplyMatrices(l[m].matrixWorld,n[m]),Ca(hr,cs,a)}}return hr.multiply(o.bindMatrix).premultiply(o.bindMatrixInverse),t.transformDirection(hr),t}function ho(o,e,t,r,s){mr.set(0,0,0);for(let l=0,n=o.length;l<n;l++){let i=e[l],a=o[l];i!==0&&(mo.fromBufferAttribute(a,r),t?mr.addScaledVector(mo,i):mr.addScaledVector(mo.sub(s),i))}s.add(mr)}function Fa(o,e={useGroups:!1,updateIndex:!1,skipAttributes:[]},t=new xe){let r=o[0].index!==null,{useGroups:s=!1,updateIndex:l=!1,skipAttributes:n=[]}=e,i=new Set(Object.keys(o[0].attributes)),a={},m=0;t.clearGroups();for(let u=0;u<o.length;++u){let f=o[u],c=0;if(r!==(f.index!==null))throw new Error("StaticGeometryGenerator: All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them.");for(let h in f.attributes){if(!i.has(h))throw new Error('StaticGeometryGenerator: All geometries must have compatible attributes; make sure "'+h+'" attribute exists among all geometries, or in none of them.');a[h]===void 0&&(a[h]=[]),a[h].push(f.attributes[h]),c++}if(c!==i.size)throw new Error("StaticGeometryGenerator: Make sure all geometries have the same number of attributes.");if(s){let h;if(r)h=f.index.count;else if(f.attributes.position!==void 0)h=f.attributes.position.count;else throw new Error("StaticGeometryGenerator: The geometry must have either an index or a position attribute");t.addGroup(m,h,u),m+=h}}if(r){let u=!1;if(!t.index){let f=0;for(let c=0;c<o.length;++c)f+=o[c].index.count;t.setIndex(new Y(new Uint32Array(f),1,!1)),u=!0}if(l||u){let f=t.index,c=0,h=0;for(let T=0;T<o.length;++T){let x=o[T],g=x.index;if(n[T]!==!0)for(let d=0;d<g.count;++d)f.setX(c,g.getX(d)+h),c++;h+=x.attributes.position.count}}}for(let u in a){let f=a[u];if(!(u in t.attributes)){let T=0;for(let x in f)T+=f[x].count;t.setAttribute(u,Rt(a[u][0],T))}let c=t.attributes[u],h=0;for(let T=0,x=f.length;T<x;T++){let g=f[T];n[T]!==!0&&fs(g,c,h),h+=g.count}}return t}function Ia(o,e){if(o===null||e===null)return o===e;if(o.length!==e.length)return!1;for(let t=0,r=o.length;t<r;t++)if(o[t]!==e[t])return!1;return!0}var De,Pe,Le,ns,mr,mo,as,ls,hr,cs,go,dr,ps=A(()=>{B();De=new C,Pe=new C,Le=new C,ns=new he,mr=new C,mo=new C,as=new he,ls=new he,hr=new z,cs=new z;go=class{constructor(e){this.matrixWorld=new z,this.geometryHash=null,this.boneMatrices=null,this.primitiveCount=-1,this.mesh=e,this.update()}update(){let e=this.mesh,t=e.geometry,r=e.skeleton,s=(t.index?t.index.count:t.attributes.position.count)/3;if(this.matrixWorld.copy(e.matrixWorld),this.geometryHash=t.attributes.position.version,this.primitiveCount=s,r){r.boneTexture||r.computeBoneTexture(),r.update();let l=r.boneMatrices;!this.boneMatrices||this.boneMatrices.length!==l.length?this.boneMatrices=l.slice():this.boneMatrices.set(l)}else this.boneMatrices=null}didChange(){let e=this.mesh,t=e.geometry,r=(t.index?t.index.count:t.attributes.position.count)/3;return!(this.matrixWorld.equals(e.matrixWorld)&&this.geometryHash===t.attributes.position.version&&Ia(e.skeleton&&e.skeleton.boneMatrices||null,this.boneMatrices)&&this.primitiveCount===r)}},dr=class{constructor(e){Array.isArray(e)||(e=[e]);let t=[];e.forEach(r=>{r.traverseVisible(s=>{s.isMesh&&t.push(s)})}),this.meshes=t,this.useGroups=!0,this.applyWorldTransforms=!0,this.attributes=["position","normal","color","tangent","uv","uv2"],this._intermediateGeometry=new Array(t.length).fill().map(()=>new xe),this._diffMap=new WeakMap}getMaterials(){let e=[];return this.meshes.forEach(t=>{Array.isArray(t.material)?e.push(...t.material):e.push(t.material)}),e}generate(e=new xe){let t=[],{meshes:r,useGroups:s,_intermediateGeometry:l,_diffMap:n}=this;for(let i=0,a=r.length;i<a;i++){let m=r[i],u=l[i],f=n.get(m);!f||f.didChange(m)?(this._convertToStaticGeometry(m,u),t.push(!1),f?f.update():n.set(m,new go(m))):t.push(!0)}Fa(l,{useGroups:s,skipAttributes:t},e);for(let i in e.attributes)e.attributes[i].needsUpdate=!0;return e}_convertToStaticGeometry(e,t=new xe){let r=e.geometry,s=this.applyWorldTransforms,l=this.attributes.includes("normal"),n=this.attributes.includes("tangent"),i=r.attributes,a=t.attributes;t.index||(t.index=r.index),a.position||t.setAttribute("position",Rt(i.position)),l&&!a.normal&&i.normal&&t.setAttribute("normal",Rt(i.normal)),n&&!a.tangent&&i.tangent&&t.setAttribute("tangent",Rt(i.tangent)),Et(r.index,t.index),Et(i.position,a.position),l&&Et(i.normal,a.normal),n&&Et(i.tangent,a.tangent);let m=i.position,u=l?i.normal:null,f=n?i.tangent:null,c=r.morphAttributes.position,h=r.morphAttributes.normal,T=r.morphAttributes.tangent,x=r.morphTargetsRelative,g=e.morphTargetInfluences,d=new _o;d.getNormalMatrix(e.matrixWorld);for(let p=0,b=i.position.count;p<b;p++)De.fromBufferAttribute(m,p),u&&Pe.fromBufferAttribute(u,p),f&&(ns.fromBufferAttribute(f,p),Le.fromBufferAttribute(f,p)),g&&(c&&ho(c,g,x,p,De),h&&ho(h,g,x,p,Pe),T&&ho(T,g,x,p,Le)),e.isSkinnedMesh&&(e.applyBoneTransform(p,De),u&&us(e,p,Pe),f&&us(e,p,Le)),s&&De.applyMatrix4(e.matrixWorld),a.position.setXYZ(p,De.x,De.y,De.z),u&&(s&&Pe.applyNormalMatrix(d),a.normal.setXYZ(p,Pe.x,Pe.y,Pe.z)),f&&(s&&Le.transformDirection(e.matrixWorld),a.tangent.setXYZW(p,Le.x,Le.y,Le.z,ns.w));for(let p in this.attributes){let b=this.attributes[p];b==="position"||b==="tangent"||b==="normal"||!(b in i)||(a[b]||t.setAttribute(b,Rt(i[b])),Et(i[b],a[b]),fs(i[b],a[b]))}return t}}});var xo,ms=A(()=>{xo=`

// A stack of uint32 indices can can store the indices for
// a perfectly balanced tree with a depth up to 31. Lower stack
// depth gets higher performance.
//
// However not all trees are balanced. Best value to set this to
// is the trees max depth.
#ifndef BVH_STACK_DEPTH
#define BVH_STACK_DEPTH 60
#endif

#ifndef INFINITY
#define INFINITY 1e20
#endif

// Utilities
uvec4 uTexelFetch1D( usampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

ivec4 iTexelFetch1D( isampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

vec4 texelFetch1D( sampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

vec4 textureSampleBarycoord( sampler2D tex, vec3 barycoord, uvec3 faceIndices ) {

	return
		barycoord.x * texelFetch1D( tex, faceIndices.x ) +
		barycoord.y * texelFetch1D( tex, faceIndices.y ) +
		barycoord.z * texelFetch1D( tex, faceIndices.z );

}

void ndcToCameraRay(
	vec2 coord, mat4 cameraWorld, mat4 invProjectionMatrix,
	out vec3 rayOrigin, out vec3 rayDirection
) {

	// get camera look direction and near plane for camera clipping
	vec4 lookDirection = cameraWorld * vec4( 0.0, 0.0, - 1.0, 0.0 );
	vec4 nearVector = invProjectionMatrix * vec4( 0.0, 0.0, - 1.0, 1.0 );
	float near = abs( nearVector.z / nearVector.w );

	// get the camera direction and position from camera matrices
	vec4 origin = cameraWorld * vec4( 0.0, 0.0, 0.0, 1.0 );
	vec4 direction = invProjectionMatrix * vec4( coord, 0.5, 1.0 );
	direction /= direction.w;
	direction = cameraWorld * direction - origin;

	// slide the origin along the ray until it sits at the near clip plane position
	origin.xyz += direction.xyz * near / dot( direction, lookDirection );

	rayOrigin = origin.xyz;
	rayDirection = direction.xyz;

}
`});var hs,ds=A(()=>{hs=`

float dot2( vec3 v ) {

	return dot( v, v );

}

// https://www.shadertoy.com/view/ttfGWl
vec3 closestPointToTriangle( vec3 p, vec3 v0, vec3 v1, vec3 v2, out vec3 barycoord ) {

    vec3 v10 = v1 - v0;
    vec3 v21 = v2 - v1;
    vec3 v02 = v0 - v2;

	vec3 p0 = p - v0;
	vec3 p1 = p - v1;
	vec3 p2 = p - v2;

    vec3 nor = cross( v10, v02 );

    // method 2, in barycentric space
    vec3  q = cross( nor, p0 );
    float d = 1.0 / dot2( nor );
    float u = d * dot( q, v02 );
    float v = d * dot( q, v10 );
    float w = 1.0 - u - v;

	if( u < 0.0 ) {

		w = clamp( dot( p2, v02 ) / dot2( v02 ), 0.0, 1.0 );
		u = 0.0;
		v = 1.0 - w;

	} else if( v < 0.0 ) {

		u = clamp( dot( p0, v10 ) / dot2( v10 ), 0.0, 1.0 );
		v = 0.0;
		w = 1.0 - u;

	} else if( w < 0.0 ) {

		v = clamp( dot( p1, v21 ) / dot2( v21 ), 0.0, 1.0 );
		w = 0.0;
		u = 1.0-v;

	}

	barycoord = vec3( u, v, w );
    return u * v1 + v * v2 + w * v0;

}

float distanceToTriangles(
	// geometry info and triangle range
	sampler2D positionAttr, usampler2D indexAttr, uint offset, uint count,

	// point and cut off range
	vec3 point, float closestDistanceSquared,

	// outputs
	inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord, inout float side, inout vec3 outPoint
) {

	bool found = false;
	vec3 localBarycoord;
	for ( uint i = offset, l = offset + count; i < l; i ++ ) {

		uvec3 indices = uTexelFetch1D( indexAttr, i ).xyz;
		vec3 a = texelFetch1D( positionAttr, indices.x ).rgb;
		vec3 b = texelFetch1D( positionAttr, indices.y ).rgb;
		vec3 c = texelFetch1D( positionAttr, indices.z ).rgb;

		// get the closest point and barycoord
		vec3 closestPoint = closestPointToTriangle( point, a, b, c, localBarycoord );
		vec3 delta = point - closestPoint;
		float sqDist = dot2( delta );
		if ( sqDist < closestDistanceSquared ) {

			// set the output results
			closestDistanceSquared = sqDist;
			faceIndices = uvec4( indices.xyz, i );
			faceNormal = normalize( cross( a - b, b - c ) );
			barycoord = localBarycoord;
			outPoint = closestPoint;
			side = sign( dot( faceNormal, delta ) );

		}

	}

	return closestDistanceSquared;

}

float distanceSqToBounds( vec3 point, vec3 boundsMin, vec3 boundsMax ) {

	vec3 clampedPoint = clamp( point, boundsMin, boundsMax );
	vec3 delta = point - clampedPoint;
	return dot( delta, delta );

}

float distanceSqToBVHNodeBoundsPoint( vec3 point, sampler2D bvhBounds, uint currNodeIndex ) {

	uint cni2 = currNodeIndex * 2u;
	vec3 boundsMin = texelFetch1D( bvhBounds, cni2 ).xyz;
	vec3 boundsMax = texelFetch1D( bvhBounds, cni2 + 1u ).xyz;
	return distanceSqToBounds( point, boundsMin, boundsMax );

}

// use a macro to hide the fact that we need to expand the struct into separate fields
#define	bvhClosestPointToPoint(		bvh,		point, faceIndices, faceNormal, barycoord, side, outPoint	)	_bvhClosestPointToPoint(		bvh.position, bvh.index, bvh.bvhBounds, bvh.bvhContents,		point, faceIndices, faceNormal, barycoord, side, outPoint	)

float _bvhClosestPointToPoint(
	// bvh info
	sampler2D bvh_position, usampler2D bvh_index, sampler2D bvh_bvhBounds, usampler2D bvh_bvhContents,

	// point to check
	vec3 point,

	// output variables
	inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
	inout float side, inout vec3 outPoint
 ) {

	// stack needs to be twice as long as the deepest tree we expect because
	// we push both the left and right child onto the stack every traversal
	int ptr = 0;
	uint stack[ BVH_STACK_DEPTH ];
	stack[ 0 ] = 0u;

	float closestDistanceSquared = pow( 100000.0, 2.0 );
	bool found = false;
	while ( ptr > - 1 && ptr < BVH_STACK_DEPTH ) {

		uint currNodeIndex = stack[ ptr ];
		ptr --;

		// check if we intersect the current bounds
		float boundsHitDistance = distanceSqToBVHNodeBoundsPoint( point, bvh_bvhBounds, currNodeIndex );
		if ( boundsHitDistance > closestDistanceSquared ) {

			continue;

		}

		uvec2 boundsInfo = uTexelFetch1D( bvh_bvhContents, currNodeIndex ).xy;
		bool isLeaf = bool( boundsInfo.x & 0xffff0000u );
		if ( isLeaf ) {

			uint count = boundsInfo.x & 0x0000ffffu;
			uint offset = boundsInfo.y;
			closestDistanceSquared = distanceToTriangles(
				bvh_position, bvh_index, offset, count, point, closestDistanceSquared,

				// outputs
				faceIndices, faceNormal, barycoord, side, outPoint
			);

		} else {

			uint leftIndex = currNodeIndex + 1u;
			uint splitAxis = boundsInfo.x & 0x0000ffffu;
			uint rightIndex = boundsInfo.y;
			bool leftToRight = distanceSqToBVHNodeBoundsPoint( point, bvh_bvhBounds, leftIndex ) < distanceSqToBVHNodeBoundsPoint( point, bvh_bvhBounds, rightIndex );//rayDirection[ splitAxis ] >= 0.0;
			uint c1 = leftToRight ? leftIndex : rightIndex;
			uint c2 = leftToRight ? rightIndex : leftIndex;

			// set c2 in the stack so we traverse it later. We need to keep track of a pointer in
			// the stack while we traverse. The second pointer added is the one that will be
			// traversed first
			ptr ++;
			stack[ ptr ] = c2;
			ptr ++;
			stack[ ptr ] = c1;

		}

	}

	return sqrt( closestDistanceSquared );

}
`});var To,gs=A(()=>{To=`

#ifndef TRI_INTERSECT_EPSILON
#define TRI_INTERSECT_EPSILON 1e-5
#endif

// Raycasting
bool intersectsBounds( vec3 rayOrigin, vec3 rayDirection, vec3 boundsMin, vec3 boundsMax, out float dist ) {

	// https://www.reddit.com/r/opengl/comments/8ntzz5/fast_glsl_ray_box_intersection/
	// https://tavianator.com/2011/ray_box.html
	vec3 invDir = 1.0 / rayDirection;

	// find intersection distances for each plane
	vec3 tMinPlane = invDir * ( boundsMin - rayOrigin );
	vec3 tMaxPlane = invDir * ( boundsMax - rayOrigin );

	// get the min and max distances from each intersection
	vec3 tMinHit = min( tMaxPlane, tMinPlane );
	vec3 tMaxHit = max( tMaxPlane, tMinPlane );

	// get the furthest hit distance
	vec2 t = max( tMinHit.xx, tMinHit.yz );
	float t0 = max( t.x, t.y );

	// get the minimum hit distance
	t = min( tMaxHit.xx, tMaxHit.yz );
	float t1 = min( t.x, t.y );

	// set distance to 0.0 if the ray starts inside the box
	dist = max( t0, 0.0 );

	return t1 >= dist;

}

bool intersectsTriangle(
	vec3 rayOrigin, vec3 rayDirection, vec3 a, vec3 b, vec3 c,
	out vec3 barycoord, out vec3 norm, out float dist, out float side
) {

	// https://stackoverflow.com/questions/42740765/intersection-between-line-and-triangle-in-3d
	vec3 edge1 = b - a;
	vec3 edge2 = c - a;
	norm = cross( edge1, edge2 );

	float det = - dot( rayDirection, norm );
	float invdet = 1.0 / det;

	vec3 AO = rayOrigin - a;
	vec3 DAO = cross( AO, rayDirection );

	vec4 uvt;
	uvt.x = dot( edge2, DAO ) * invdet;
	uvt.y = - dot( edge1, DAO ) * invdet;
	uvt.z = dot( AO, norm ) * invdet;
	uvt.w = 1.0 - uvt.x - uvt.y;

	// set the hit information
	barycoord = uvt.wxy; // arranged in A, B, C order
	dist = uvt.z;
	side = sign( det );
	norm = side * normalize( norm );

	// add an epsilon to avoid misses between triangles
	uvt += vec4( TRI_INTERSECT_EPSILON );

	return all( greaterThanEqual( uvt, vec4( 0.0 ) ) );

}

bool intersectTriangles(
	// geometry info and triangle range
	sampler2D positionAttr, usampler2D indexAttr, uint offset, uint count,

	// ray
	vec3 rayOrigin, vec3 rayDirection,

	// outputs
	inout float minDistance, inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
	inout float side, inout float dist
) {

	bool found = false;
	vec3 localBarycoord, localNormal;
	float localDist, localSide;
	for ( uint i = offset, l = offset + count; i < l; i ++ ) {

		uvec3 indices = uTexelFetch1D( indexAttr, i ).xyz;
		vec3 a = texelFetch1D( positionAttr, indices.x ).rgb;
		vec3 b = texelFetch1D( positionAttr, indices.y ).rgb;
		vec3 c = texelFetch1D( positionAttr, indices.z ).rgb;

		if (
			intersectsTriangle( rayOrigin, rayDirection, a, b, c, localBarycoord, localNormal, localDist, localSide )
			&& localDist < minDistance
		) {

			found = true;
			minDistance = localDist;

			faceIndices = uvec4( indices.xyz, i );
			faceNormal = localNormal;

			side = localSide;
			barycoord = localBarycoord;
			dist = localDist;

		}

	}

	return found;

}

bool intersectsBVHNodeBounds( vec3 rayOrigin, vec3 rayDirection, sampler2D bvhBounds, uint currNodeIndex, out float dist ) {

	uint cni2 = currNodeIndex * 2u;
	vec3 boundsMin = texelFetch1D( bvhBounds, cni2 ).xyz;
	vec3 boundsMax = texelFetch1D( bvhBounds, cni2 + 1u ).xyz;
	return intersectsBounds( rayOrigin, rayDirection, boundsMin, boundsMax, dist );

}

// use a macro to hide the fact that we need to expand the struct into separate fields
#define	bvhIntersectFirstHit(		bvh,		rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, dist	)	_bvhIntersectFirstHit(		bvh.position, bvh.index, bvh.bvhBounds, bvh.bvhContents,		rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, dist	)

bool _bvhIntersectFirstHit(
	// bvh info
	sampler2D bvh_position, usampler2D bvh_index, sampler2D bvh_bvhBounds, usampler2D bvh_bvhContents,

	// ray
	vec3 rayOrigin, vec3 rayDirection,

	// output variables split into separate variables due to output precision
	inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
	inout float side, inout float dist
) {

	// stack needs to be twice as long as the deepest tree we expect because
	// we push both the left and right child onto the stack every traversal
	int ptr = 0;
	uint stack[ BVH_STACK_DEPTH ];
	stack[ 0 ] = 0u;

	float triangleDistance = INFINITY;
	bool found = false;
	while ( ptr > - 1 && ptr < BVH_STACK_DEPTH ) {

		uint currNodeIndex = stack[ ptr ];
		ptr --;

		// check if we intersect the current bounds
		float boundsHitDistance;
		if (
			! intersectsBVHNodeBounds( rayOrigin, rayDirection, bvh_bvhBounds, currNodeIndex, boundsHitDistance )
			|| boundsHitDistance > triangleDistance
		) {

			continue;

		}

		uvec2 boundsInfo = uTexelFetch1D( bvh_bvhContents, currNodeIndex ).xy;
		bool isLeaf = bool( boundsInfo.x & 0xffff0000u );

		if ( isLeaf ) {

			uint count = boundsInfo.x & 0x0000ffffu;
			uint offset = boundsInfo.y;

			found = intersectTriangles(
				bvh_position, bvh_index, offset, count,
				rayOrigin, rayDirection, triangleDistance,
				faceIndices, faceNormal, barycoord, side, dist
			) || found;

		} else {

			uint leftIndex = currNodeIndex + 1u;
			uint splitAxis = boundsInfo.x & 0x0000ffffu;
			uint rightIndex = boundsInfo.y;

			bool leftToRight = rayDirection[ splitAxis ] >= 0.0;
			uint c1 = leftToRight ? leftIndex : rightIndex;
			uint c2 = leftToRight ? rightIndex : leftIndex;

			// set c2 in the stack so we traverse it later. We need to keep track of a pointer in
			// the stack while we traverse. The second pointer added is the one that will be
			// traversed first
			ptr ++;
			stack[ ptr ] = c2;

			ptr ++;
			stack[ ptr ] = c1;

		}

	}

	return found;

}
`});var xs,Ts=A(()=>{xs=`
struct BVH {

	usampler2D index;
	sampler2D position;

	sampler2D bvhBounds;
	usampler2D bvhContents;

};
`});var Ce={};jn(Ce,{bvh_distance_functions:()=>hs,bvh_ray_functions:()=>To,bvh_struct_definitions:()=>xs,common_functions:()=>xo});var bo=A(()=>{ms();ds();gs();Ts()});var k0,gr=A(()=>{os();qe();Be();ss();po();ps();bo();bo();k0=`
	${xo}
	${To}
`});function vs(o,e=!1){let t=o[0].index!==null,r=new Set(Object.keys(o[0].attributes)),s=new Set(Object.keys(o[0].morphAttributes)),l={},n={},i=o[0].morphTargetsRelative,a=new xe,m=0;for(let u=0;u<o.length;++u){let f=o[u],c=0;if(t!==(f.index!==null))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+u+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(let h in f.attributes){if(!r.has(h))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+u+'. All geometries must have compatible attributes; make sure "'+h+'" attribute exists among all geometries, or in none of them.'),null;l[h]===void 0&&(l[h]=[]),l[h].push(f.attributes[h]),c++}if(c!==r.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+u+". Make sure all geometries have the same number of attributes."),null;if(i!==f.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+u+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(let h in f.morphAttributes){if(!s.has(h))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+u+".  .morphAttributes must be consistent throughout all geometries."),null;n[h]===void 0&&(n[h]=[]),n[h].push(f.morphAttributes[h])}if(e){let h;if(t)h=f.index.count;else if(f.attributes.position!==void 0)h=f.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+u+". The geometry must have either an index or a position attribute"),null;a.addGroup(m,h,u),m+=h}}if(t){let u=0,f=[];for(let c=0;c<o.length;++c){let h=o[c].index;for(let T=0;T<h.count;++T)f.push(h.getX(T)+u);u+=o[c].attributes.position.count}a.setIndex(f)}for(let u in l){let f=bs(l[u]);if(!f)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+u+" attribute."),null;a.setAttribute(u,f)}for(let u in n){let f=n[u][0].length;if(f===0)break;a.morphAttributes=a.morphAttributes||{},a.morphAttributes[u]=[];for(let c=0;c<f;++c){let h=[];for(let x=0;x<n[u].length;++x)h.push(n[u][x][c]);let T=bs(h);if(!T)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+u+" morphAttribute."),null;a.morphAttributes[u].push(T)}}return a}function bs(o){let e,t,r,s=-1,l=0;for(let m=0;m<o.length;++m){let u=o[m];if(u.isInterleavedBufferAttribute)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. InterleavedBufferAttributes are not supported."),null;if(e===void 0&&(e=u.array.constructor),e!==u.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(t===void 0&&(t=u.itemSize),t!==u.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(r===void 0&&(r=u.normalized),r!==u.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(s===-1&&(s=u.gpuType),s!==u.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;l+=u.array.length}let n=new e(l),i=0;for(let m=0;m<o.length;++m)n.set(o[m].array,i),i+=o[m].array.length;let a=new Y(n,t,r);return s!==void 0&&(a.gpuType=s),a}function ys(o,e=1e-4){e=Math.max(e,Number.EPSILON);let t={},r=o.getIndex(),s=o.getAttribute("position"),l=r?r.count:s.count,n=0,i=Object.keys(o.attributes),a={},m={},u=[],f=["getX","getY","getZ","getW"],c=["setX","setY","setZ","setW"];for(let p=0,b=i.length;p<b;p++){let v=i[p],y=o.attributes[v];a[v]=new Y(new y.array.constructor(y.count*y.itemSize),y.itemSize,y.normalized);let E=o.morphAttributes[v];E&&(m[v]=new Y(new E.array.constructor(E.count*E.itemSize),E.itemSize,E.normalized))}let h=e*.5,T=Math.log10(1/e),x=Math.pow(10,T),g=h*x;for(let p=0;p<l;p++){let b=r?r.getX(p):p,v="";for(let y=0,E=i.length;y<E;y++){let S=i[y],w=o.getAttribute(S),R=w.itemSize;for(let M=0;M<R;M++)v+=`${~~(w[f[M]](b)*x+g)},`}if(v in t)u.push(t[v]);else{for(let y=0,E=i.length;y<E;y++){let S=i[y],w=o.getAttribute(S),R=o.morphAttributes[S],M=w.itemSize,I=a[S],_=m[S];for(let F=0;F<M;F++){let H=f[F],D=c[F];if(I[D](n,w[H](b)),R)for(let L=0,ce=R.length;L<ce;L++)_[L][D](n,R[L][H](b))}}t[v]=n,u.push(n),n++}}let d=o.clone();for(let p in o.attributes){let b=a[p];if(d.setAttribute(p,new Y(b.array.slice(0,n*b.itemSize),b.itemSize,b.normalized)),p in m)for(let v=0;v<m[p].length;v++){let y=m[p][v];d.morphAttributes[p][v]=new Y(y.array.slice(0,n*y.itemSize),y.itemSize,y.normalized)}}return d.setIndex(u),d}var Es=A(()=>{B()});function Ha(o,e,t){let r=o.index,l=o.attributes.position.count,n=r?r.count:l,i=o.groups;i.length===0&&(i=[{count:n,start:0,materialIndex:0}]);let a;t.length<=255?a=new Uint8Array(l):a=new Uint16Array(l);for(let m=0;m<i.length;m++){let u=i[m],f=u.start,c=u.count,h=Math.min(c,n-f),T=Array.isArray(e)?e[u.materialIndex]:e,x=t.indexOf(T);for(let g=0;g<h;g++){let d=f+g;r&&(d=r.getX(d)),a[d]=x}}return new Y(a,1,!1)}function Ba(o,e){if(e)for(let t in o.attributes)e.includes(t)||o.deleteAttribute(t)}function Da(o,e){let{attributes:t=[],normalMapRequired:r=!1}=e;if(!o.attributes.normal&&t&&t.includes("normal")&&o.computeVertexNormals(),!o.attributes.uv&&t&&t.includes("uv")){let s=o.attributes.position.count;o.setAttribute("uv",new Y(new Float32Array(s*2),2,!1))}if(!o.attributes.tangent&&t&&t.includes("tangent"))if(r)o.index===null&&(o=ys(o)),o.computeTangents();else{let s=o.attributes.position.count;o.setAttribute("tangent",new Y(new Float32Array(s*4),4,!1))}if(!o.attributes.color&&t&&t.includes("color")){let s=o.attributes.position.count,l=new Float32Array(s*4);l.fill(1),o.setAttribute("color",new Y(l,4))}if(!o.index){let s=o.attributes.position.count,l=new Array(s);for(let n=0;n<s;n++)l[n]=n;o.setIndex(l)}}function Rs(o,e={}){e={attributes:null,cloneGeometry:!0,...e};let t=[],r=new Set;for(let a=0,m=o.length;a<m;a++){let u=o[a];u.visible!==!1&&(Array.isArray(u.material)?u.material.forEach(f=>r.add(f)):r.add(u.material))}let s=Array.from(r);for(let a=0,m=o.length;a<m;a++){let u=o[a];if(u.visible===!1)continue;u.updateMatrixWorld();let f=o[a].geometry,c=e.cloneGeometry?f.clone():f;c.applyMatrix4(u.matrixWorld),u.matrixWorld.determinant()<0&&c.index.array.reverse(),Da(c,{attributes:e.attributes,normalMapRequired:!!u.material.normalMap}),Ba(c,e.attributes);let h=Ha(c,u.material,s);c.setAttribute("materialIndex",h),t.push(c)}let l=new Set;s.forEach(a=>{for(let m in a){let u=a[m];u&&u.isTexture&&l.add(u)}});let n=vs(t,!1),i=Array.from(l);return{geometry:n,materials:s,textures:i}}var Ss=A(()=>{B();Es()});var xr,ws=A(()=>{B();gr();Ss();xr=class{prepScene(e){e=Array.isArray(e)?e:[e];let t=[],r=[];for(let s=0,l=e.length;s<l;s++)e[s].traverseVisible(n=>{if(n.isSkinnedMesh||n.isMesh&&n.morphTargetInfluences){let i=new dr(n);i.attributes=["position","color","normal","tangent","uv","uv2"],i.applyWorldTransforms=!1;let a=new Ct(i.generate(),n.material);a.matrixWorld.copy(n.matrixWorld),a.matrix.copy(n.matrixWorld),a.matrix.decompose(a.position,a.quaternion,a.scale),t.push(a)}else n.isMesh?t.push(n):(n.isRectAreaLight||n.isSpotLight||n.isPointLight||n.isDirectionalLight)&&r.push(n)});return{...Rs(t,{attributes:["position","normal","tangent","uv","color"]}),lights:r}}generate(e,t={}){let{materials:r,textures:s,geometry:l,lights:n}=this.prepScene(e),i={strategy:2,...t,maxLeafTris:1};return{scene:e,materials:r,textures:s,lights:n,bvh:new yt(l,i)}}}});var Tr,As=A(()=>{B();Tr=class extends Fo{set bokehSize(e){this.fStop=this.getFocalLength()/e}get bokehSize(){return this.getFocalLength()/this.fStop}constructor(...e){super(...e),this.fStop=1.4,this.apertureBlades=0,this.apertureRotation=0,this.focusDistance=25,this.anamorphicRatio=1}copy(e,t){return super.copy(e,t),this.fStop=e.fStop,this.apertureBlades=e.apertureBlades,this.apertureRotation=e.apertureRotation,this.focusDistance=e.focusDistance,this.anamorphicRatio=e.anamorphicRatio,this}}});var br,_s=A(()=>{As();br=class{constructor(){this.bokehSize=0,this.apertureBlades=0,this.apertureRotation=0,this.focusDistance=10,this.anamorphicRatio=1}updateFrom(e){e instanceof Tr?(this.bokehSize=e.bokehSize,this.apertureBlades=e.apertureBlades,this.apertureRotation=e.apertureRotation,this.focusDistance=e.focusDistance,this.anamorphicRatio=e.anamorphicRatio):(this.bokehSize=0,this.apertureRotation=0,this.apertureBlades=0,this.focusDistance=10,this.anamorphicRatio=1)}}});function Ge(o){let e=new Uint16Array(o.length);for(let t=0,r=o.length;t<r;++t)e[t]=se.toHalfFloat(o[t]);return e}var vo=A(()=>{B()});function Ms(o,e,t=0,r=o.length){let s=t,l=t+r-1;for(;s<l;){let n=s+l>>1;o[n]<e?s=n+1:l=n}return s-t}function Pa(o,e,t){return .2126*o+.7152*e+.0722*t}function La(o){let e=o.clone();e.source=new Lo({...e.image});let{width:t,height:r,data:s}=e.image,l=s;if(e.type===ee){l=new Uint16Array(s.length);for(let n in s)l[n]=s[n];e.image.data=l,e.type=ee}if(e.flipY){let n=l;l=l.slice();for(let i=0;i<r;i++)for(let a=0;a<t;a++){let m=r-i-1,u=4*(i*t+a),f=4*(m*t+a);l[f+0]=n[u+0],l[f+1]=n[u+1],l[f+2]=n[u+2],l[f+3]=n[u+3]}e.flipY=!1,e.image.data=l}return e}var vr,Cs=A(()=>{B();vo();vr=class{constructor(){let e=new K(Ge(new Float32Array([1,1,1,1])),1,1);e.type=ee,e.format=O,e.minFilter=X,e.magFilter=X,e.wrapS=me,e.wrapT=me,e.generateMipmaps=!1,e.needsUpdate=!0;let t=new K(Ge(new Float32Array([0,1])),1,2);t.type=ee,t.format=ye,t.minFilter=X,t.magFilter=X,t.generateMipmaps=!1,t.needsUpdate=!0;let r=new K(Ge(new Float32Array([0,0,1,1])),2,2);r.type=ee,r.format=ye,r.minFilter=X,r.magFilter=X,r.generateMipmaps=!1,r.needsUpdate=!0,this.map=e,this.marginalWeights=t,this.conditionalWeights=r,this.totalSum=1}dispose(){this.marginalWeights.dispose(),this.conditionalWeights.dispose(),this.map.dispose()}updateFrom(e){let t=La(e);t.wrapS=me,t.wrapT=me;let{width:r,height:s,data:l}=t.image,n=new Float32Array(r*s),i=new Float32Array(r*s),a=new Float32Array(s),m=new Float32Array(s),u=0,f=0;for(let g=0;g<s;g++){let d=0;for(let p=0;p<r;p++){let b=g*r+p,v=se.fromHalfFloat(l[4*b+0]),y=se.fromHalfFloat(l[4*b+1]),E=se.fromHalfFloat(l[4*b+2]),S=Pa(v,y,E);d+=S,u+=S,n[b]=S,i[b]=d}if(d!==0)for(let p=g*r,b=g*r+r;p<b;p++)n[p]/=d,i[p]/=d;f+=d,a[g]=d,m[g]=f}if(f!==0)for(let g=0,d=a.length;g<d;g++)a[g]/=f,m[g]/=f;let c=new Uint16Array(s),h=new Uint16Array(r*s);for(let g=0;g<s;g++){let d=(g+1)/s,p=Ms(m,d);c[g]=se.toHalfFloat((p+.5)/s)}for(let g=0;g<s;g++)for(let d=0;d<r;d++){let p=g*r+d,b=(d+1)/r,v=Ms(i,b,g*r,r);h[p]=se.toHalfFloat((v+.5)/r)}this.dispose();let{marginalWeights:T,conditionalWeights:x}=this;T.image={width:s,height:1,data:c},T.needsUpdate=!0,x.image={width:r,height:s,data:h},x.needsUpdate=!0,this.totalSum=u,this.map=t}}});var Fs,Ga,Na,Oa,za,Ua,yr,Is=A(()=>{B();Fs=6,Ga=0,Na=1,Oa=2,za=3,Ua=4,yr=class{constructor(){let e=new K(new Float32Array(4),1,1);e.format=O,e.type=j,e.wrapS=ue,e.wrapT=ue,e.generateMipmaps=!1,e.minFilter=te,e.magFilter=te,this.tex=e,this.count=0}updateFrom(e,t=[]){let r=this.tex,s=Math.max(e.length*Fs,1),l=Math.ceil(Math.sqrt(s));r.image.width!==l&&(r.dispose(),r.image.data=new Float32Array(l*l*4),r.image.width=l,r.image.height=l);let n=r.image.data,i=new C,a=new C,m=new z,u=new Io,f=new C,c=new C,h=new C(0,1,0);for(let T=0,x=e.length;T<x;T++){let g=e[T],d=T*Fs*4,p=0;g.getWorldPosition(a),n[d+p++]=a.x,n[d+p++]=a.y,n[d+p++]=a.z;let b=Ga;if(g.isRectAreaLight&&g.isCircular?b=Na:g.isSpotLight?b=Oa:g.isDirectionalLight?b=za:g.isPointLight&&(b=Ua),n[d+p++]=b,n[d+p++]=g.color.r,n[d+p++]=g.color.g,n[d+p++]=g.color.b,n[d+p++]=g.intensity,g.getWorldQuaternion(u),g.isRectAreaLight)i.set(g.width,0,0).applyQuaternion(u),n[d+p++]=i.x,n[d+p++]=i.y,n[d+p++]=i.z,p++,a.set(0,g.height,0).applyQuaternion(u),n[d+p++]=a.x,n[d+p++]=a.y,n[d+p++]=a.z,n[d+p++]=i.cross(a).length()*(g.isCircular?Math.PI/4:1);else if(g.isSpotLight){let v=g.radius;f.setFromMatrixPosition(g.matrixWorld),c.setFromMatrixPosition(g.target.matrixWorld),m.lookAt(f,c,h),u.setFromRotationMatrix(m),i.set(1,0,0).applyQuaternion(u),n[d+p++]=i.x,n[d+p++]=i.y,n[d+p++]=i.z,p++,a.set(0,1,0).applyQuaternion(u),n[d+p++]=a.x,n[d+p++]=a.y,n[d+p++]=a.z,n[d+p++]=Math.PI*v*v,n[d+p++]=v,n[d+p++]=g.shadow.camera.near,n[d+p++]=g.decay,n[d+p++]=g.distance,n[d+p++]=Math.cos(g.angle),n[d+p++]=Math.cos(g.angle*(1-g.penumbra)),n[d+p++]=t.indexOf(g.iesTexture)}else if(g.isPointLight){let v=i.setFromMatrixPosition(g.matrixWorld);n[d+p++]=v.x,n[d+p++]=v.y,n[d+p++]=v.z,p++,p+=4,p+=2,n[d+p++]=g.decay,n[d+p++]=g.distance}else if(g.isDirectionalLight){let v=i.setFromMatrixPosition(g.matrixWorld),y=a.setFromMatrixPosition(g.target.matrixWorld);c.subVectors(v,y).normalize(),n[d+p++]=c.x,n[d+p++]=c.y,n[d+p++]=c.z}}r.needsUpdate=!0,this.count=e.length}}});function Hs(o){let e=this,t=o.split(`
`),r=0,s;e.verAngles=[],e.horAngles=[],e.candelaValues=[],e.tiltData={},e.tiltData.angles=[],e.tiltData.mulFactors=[];function l(c){return c=c.trim(),c=c.replace(/,/g," "),c=c.replace(/\s\s+/g," "),c.split(" ")}function n(c,h){for(;;){let T=t[r++],x=l(T);for(let g=0;g<x.length;++g)h.push(Number(x[g]));if(h.length===c)break}}function i(){let c=t[r++],h=l(c);e.tiltData.lampToLumGeometry=Number(h[0]),c=t[r++],h=l(c),e.tiltData.numAngles=Number(h[0]),n(e.tiltData.numAngles,e.tiltData.angles),n(e.tiltData.numAngles,e.tiltData.mulFactors)}function a(){let c=[];n(10,c),e.count=Number(c[0]),e.lumens=Number(c[1]),e.multiplier=Number(c[2]),e.numVerAngles=Number(c[3]),e.numHorAngles=Number(c[4]),e.gonioType=Number(c[5]),e.units=Number(c[6]),e.width=Number(c[7]),e.length=Number(c[8]),e.height=Number(c[9])}function m(){let c=[];n(3,c),e.ballFactor=Number(c[0]),e.blpFactor=Number(c[1]),e.inputWatts=Number(c[2])}for(;s=t[r++],!s.includes("TILT"););s.includes("NONE")||s.includes("INCLUDE")&&i(),a(),m();for(let c=0;c<e.numHorAngles;++c)e.candelaValues.push([]);n(e.numVerAngles,e.verAngles),n(e.numHorAngles,e.horAngles);for(let c=0;c<e.numHorAngles;++c)n(e.numVerAngles,e.candelaValues[c]);for(let c=0;c<e.numHorAngles;++c)for(let h=0;h<e.numVerAngles;++h)e.candelaValues[c][h]*=e.candelaValues[c][h]*e.multiplier*e.ballFactor*e.blpFactor;let u=-1;for(let c=0;c<e.numHorAngles;++c)for(let h=0;h<e.numVerAngles;++h){let T=e.candelaValues[c][h];u=u<T?T:u}if(!0&&u>0)for(let c=0;c<e.numHorAngles;++c)for(let h=0;h<e.numVerAngles;++h)e.candelaValues[c][h]/=u}var Er,Bs=A(()=>{B();vo();Er=class extends Ao{_getIESValues(e){let l=new Float32Array(64800);function n(m,u){let f=0,c=0,h=0,T=0,x=0,g=0;for(let R=0;R<e.numHorAngles-1;++R)if(u<e.horAngles[R+1]||R==e.numHorAngles-2){c=R,h=e.horAngles[R],T=e.horAngles[R+1];break}for(let R=0;R<e.numVerAngles-1;++R)if(m<e.verAngles[R+1]||R==e.numVerAngles-2){f=R,x=e.verAngles[R],g=e.verAngles[R+1];break}let d=T-h,p=g-x;if(p===0)return 0;let b=d===0?0:(u-h)/d,v=(m-x)/p,y=d===0?c:c+1,E=Mt.lerp(e.candelaValues[c][f],e.candelaValues[y][f],b),S=Mt.lerp(e.candelaValues[c][f+1],e.candelaValues[y][f+1],b);return Mt.lerp(E,S,v)}let i=e.horAngles[0],a=e.horAngles[e.numHorAngles-1];for(let m=0;m<64800;++m){let u=m%360,f=Math.floor(m/360);a-i!==0&&(u<i||u>=a)&&(u%=a*2,u>a&&(u=a*2-u)),l[m]=n(f,u)}return l}load(e,t,r,s){let l=new wo(this.manager);l.setResponseType("text"),l.setCrossOrigin(this.crossOrigin),l.setWithCredentials(this.withCredentials),l.setPath(this.path),l.setRequestHeader(this.requestHeader);let n=new K(null,360,180,ye,ee);return n.minFilter=X,n.magFilter=X,l.load(e,i=>{let a=new Hs(i);n.image.data=Ge(this._getIESValues(a)),n.needsUpdate=!0,t!==void 0&&t(n)},r,s),n}parse(e){let t=new Hs(e),r=new K(null,360,180,ye,ee);return r.minFilter=X,r.magFilter=X,r.image.data=Ge(this._getIESValues(t)),r.needsUpdate=!0,r}}});var Ds,Rr,Ps=A(()=>{B();Ue();Bs();Ds=new fe,Rr=class extends Pt{constructor(...e){super(...e);let t=this.texture;t.format=O,t.type=ee,t.minFilter=X,t.magFilter=X,t.wrapS=ue,t.wrapT=ue,t.generateMipmaps=!1,t.updateFrom=(...s)=>{this.updateFrom(...s)};let r=new ne(new Ft);this.fsQuad=r,this.iesLoader=new Er}async updateFrom(e,t){let r=e.getRenderTarget(),s=e.toneMapping,l=e.getClearAlpha();e.getClearColor(Ds);let n=t.length||1;this.setSize(360,180,n),e.setClearColor(0,0),e.toneMapping=It;let i=this.fsQuad;for(let a=0,m=n;a<m;a++){let u=t[a];u&&(u.matrixAutoUpdate=!1,u.matrix.identity(),i.material.map=u,i.material.transparent=!0,e.setRenderTarget(this,a),i.render(e),u.updateMatrix(),u.matrixAutoUpdate=!0)}i.material.map=null,e.setClearColor(Ds,l),e.setRenderTarget(r),e.toneMapping=s,i.dispose()}dispose(){super.dispose(),this.fsQuad.dispose()}}});function Ls(o,e,t,r,s){if(e>r)throw new Error;let l=o.length/e,n=o.constructor.BYTES_PER_ELEMENT*8,i=1;switch(o.constructor){case Uint8Array:case Uint16Array:case Uint32Array:i=2**n-1;break;case Int8Array:case Int16Array:case Int32Array:i=2**(n-1)-1;break}for(let a=0;a<l;a++){let m=4*a,u=e*a;for(let f=0;f<r;f++)t[s+m+f]=e>=f+1?o[u+f]/i:0}}var Sr,Gs=A(()=>{B();gr();Sr=class extends Ro{constructor(){super(),this._textures=[],this.type=j,this.format=O,this.internalFormat="RGBA32F"}updateAttribute(e,t){let r=this._textures[e];r.updateFrom(t);let s=r.image,l=this.image;if(s.width!==l.width||s.height!==l.height)throw new Error("FloatAttributeTextureArray: Attribute must be the same dimensions when updating single layer.");let{width:n,height:i,data:a}=l,u=n*i*4*e,f=t.itemSize;f===3&&(f=4),Ls(r.image.data,f,a,4,u),this.dispose(),this.needsUpdate=!0}setAttributes(e){let t=e[0].count,r=e.length;for(let f=0,c=r;f<c;f++)if(e[f].count!==t)throw new Error("FloatAttributeTextureArray: All attributes must have the same item count.");let s=this._textures;for(;s.length<r;){let f=new nt;s.push(f)}for(;s.length>r;)s.pop();for(let f=0,c=r;f<c;f++)s[f].updateFrom(e[f]);let n=s[0].image,i=this.image;(n.width!==i.width||n.height!==i.height||n.depth!==r)&&(i.width=n.width,i.height=n.height,i.depth=r,i.data=new Float32Array(i.width*i.height*i.depth*4));let{data:a,width:m,height:u}=i;for(let f=0,c=r;f<c;f++){let h=s[f],x=m*u*4*f,g=e[f].itemSize;g===3&&(g=4),Ls(h.image.data,g,a,4,x)}this.dispose(),this.needsUpdate=!0}}});var wr,Ns=A(()=>{Gs();wr=class extends Sr{updateNormalAttribute(e){this.updateAttribute(0,e)}updateTangentAttribute(e){this.updateAttribute(1,e)}updateUvAttribute(e){this.updateAttribute(2,e)}updateColorAttribute(e){this.updateAttribute(3,e)}updateFrom(e,t,r,s){this.setAttributes([e,t,r,s])}}});function Ar(o){return`${o.source.uuid}:${o.encoding}`}function _r(o){let e=new Set,t=[];for(let r=0,s=o.length;r<s;r++){let l=o[r],n=Ar(l);e.has(n)||(e.add(n),t.push(l))}return t}var yo=A(()=>{});var Us,at,Os,zs,Eo,Mr,ks=A(()=>{B();yo();Us=45,at=Us*4,Os=14*4+0,zs=14*4+1,Eo=class{constructor(){this._features={}}isUsed(e){return e in this._features}setUsed(e,t=!0){t===!1?delete this._features[e]:this._features[e]=!0}reset(){this._features={}}},Mr=class extends K{constructor(){super(new Float32Array(4),1,1),this.format=O,this.type=j,this.wrapS=ue,this.wrapT=ue,this.minFilter=te,this.magFilter=te,this.generateMipmaps=!1,this.threeCompatibilityTransforms=!1,this.features=new Eo}setCastShadow(e,t){let r=this.image.data,s=e*at+zs;r[s]=t?0:1}getCastShadow(e){let t=this.image.data,r=e*at+zs;return!t[r]}setMatte(e,t){let r=this.image.data,s=e*at+Os;r[s]=t?1:0}getMatte(e){let t=this.image.data,r=e*at+Os;return!!t[r]}updateFrom(e,t){function r(g,d,p=-1){if(d in g&&g[d]){let b=Ar(g[d]);return T[b]}else return p}function s(g,d,p){return d in g?g[d]:p}function l(g){return g.map||g.specularMap||g.displacementMap||g.normalMap||g.bumpMap||g.roughnessMap||g.metalnessMap||g.alphaMap||g.emissiveMap||g.clearcoatMap||g.clearcoatNormalMap||g.clearcoatRoughnessMap||g.iridescenceMap||g.iridescenceThicknessMap||g.specularIntensityMap||g.specularColorMap||g.transmissionMap||g.thicknessMap||g.sheenColorMap||g.sheenRoughnessMap||null}function n(g,d,p,b){let v;if(u?v=l(g):v=g[d]&&g[d].isTexture?g[d]:null,v){let y=v.matrix.elements,E=0;p[b+E++]=y[0],p[b+E++]=y[3],p[b+E++]=y[6],E++,p[b+E++]=y[1],p[b+E++]=y[4],p[b+E++]=y[7],E++}return 8}let i=0,a=e.length*Us,m=Math.ceil(Math.sqrt(a)),{threeCompatibilityTransforms:u,image:f,features:c}=this,h=_r(t),T={};for(let g=0,d=h.length;g<d;g++)T[Ar(h[g])]=g;f.width!==m&&(this.dispose(),f.data=new Float32Array(m*m*4),f.width=m,f.height=m);let x=f.data;c.reset();for(let g=0,d=e.length;g<d;g++){let p=e[g];if(p.isFogVolumeMaterial){c.setUsed("FOG");for(let y=0;y<at;y++)x[i+y]=0;x[i+0*4+0]=p.color.r,x[i+0*4+1]=p.color.g,x[i+0*4+2]=p.color.b,x[i+2*4+3]=s(p,"emissiveIntensity",0),x[i+3*4+0]=p.emissive.r,x[i+3*4+1]=p.emissive.g,x[i+3*4+2]=p.emissive.b,x[i+13*4+1]=p.density,x[i+13*4+3]=0,x[i+14*4+2]=4,i+=at;continue}x[i++]=p.color.r,x[i++]=p.color.g,x[i++]=p.color.b,x[i++]=r(p,"map"),x[i++]=s(p,"metalness",0),x[i++]=r(p,"metalnessMap"),x[i++]=s(p,"roughness",0),x[i++]=r(p,"roughnessMap"),x[i++]=s(p,"ior",1.5),x[i++]=s(p,"transmission",0),x[i++]=r(p,"transmissionMap"),x[i++]=s(p,"emissiveIntensity",0),"emissive"in p?(x[i++]=p.emissive.r,x[i++]=p.emissive.g,x[i++]=p.emissive.b):(x[i++]=0,x[i++]=0,x[i++]=0),x[i++]=r(p,"emissiveMap"),x[i++]=r(p,"normalMap"),"normalScale"in p?(x[i++]=p.normalScale.x,x[i++]=p.normalScale.y):(x[i++]=1,x[i++]=1),x[i++]=s(p,"clearcoat",0),x[i++]=r(p,"clearcoatMap"),x[i++]=s(p,"clearcoatRoughness",0),x[i++]=r(p,"clearcoatRoughnessMap"),x[i++]=r(p,"clearcoatNormalMap"),"clearcoatNormalScale"in p?(x[i++]=p.clearcoatNormalScale.x,x[i++]=p.clearcoatNormalScale.y):(x[i++]=1,x[i++]=1),i++,x[i++]=s(p,"sheen",0),"sheenColor"in p?(x[i++]=p.sheenColor.r,x[i++]=p.sheenColor.g,x[i++]=p.sheenColor.b):(x[i++]=0,x[i++]=0,x[i++]=0),x[i++]=r(p,"sheenColorMap"),x[i++]=s(p,"sheenRoughness",0),x[i++]=r(p,"sheenRoughnessMap"),x[i++]=r(p,"iridescenceMap"),x[i++]=r(p,"iridescenceThicknessMap"),x[i++]=s(p,"iridescence",0),x[i++]=s(p,"iridescenceIOR",1.3);let b=s(p,"iridescenceThicknessRange",[100,400]);x[i++]=b[0],x[i++]=b[1],"specularColor"in p?(x[i++]=p.specularColor.r,x[i++]=p.specularColor.g,x[i++]=p.specularColor.b):(x[i++]=1,x[i++]=1,x[i++]=1),x[i++]=r(p,"specularColorMap"),x[i++]=s(p,"specularIntensity",1),x[i++]=r(p,"specularIntensityMap");let v=s(p,"thickness",0)===0&&s(p,"attenuationDistance",1/0)===1/0;if(x[i++]=Number(v),i++,"attenuationColor"in p?(x[i++]=p.attenuationColor.r,x[i++]=p.attenuationColor.g,x[i++]=p.attenuationColor.b):(x[i++]=1,x[i++]=1,x[i++]=1),x[i++]=s(p,"attenuationDistance",1/0),x[i++]=r(p,"alphaMap"),x[i++]=p.opacity,x[i++]=p.alphaTest,!v&&p.transmission>0)x[i++]=0;else switch(p.side){case ut:x[i++]=1;break;case St:x[i++]=-1;break;case wt:x[i++]=0;break}i++,i++,x[i++]=Number(p.vertexColors)|Number(p.flatShading)<<1,x[i++]=Number(p.transparent),i+=n(p,"map",x,i),i+=n(p,"metalnessMap",x,i),i+=n(p,"roughnessMap",x,i),i+=n(p,"transmissionMap",x,i),i+=n(p,"emissiveMap",x,i),i+=n(p,"normalMap",x,i),i+=n(p,"clearcoatMap",x,i),i+=n(p,"clearcoatNormalMap",x,i),i+=n(p,"clearcoatRoughnessMap",x,i),i+=n(p,"sheenColorMap",x,i),i+=n(p,"sheenRoughnessMap",x,i),i+=n(p,"iridescenceMap",x,i),i+=n(p,"iridescenceThicknessMap",x,i),i+=n(p,"specularColorMap",x,i),i+=n(p,"specularIntensityMap",x,i)}this.needsUpdate=!0}}});var Vs,Cr,Ws=A(()=>{B();Ue();yo();Vs=new fe,Cr=class extends Pt{constructor(...e){super(...e);let t=this.texture;t.format=O,t.type=ft,t.minFilter=X,t.magFilter=X,t.wrapS=me,t.wrapT=me,t.setTextures=(...s)=>{this.setTextures(...s)};let r=new ne(new Ft);this.fsQuad=r}setTextures(e,t,r,s){let l=_r(s),n=e.getRenderTarget(),i=e.toneMapping,a=e.getClearAlpha();e.getClearColor(Vs);let m=l.length||1;this.setSize(t,r,m),e.setClearColor(0,0),e.toneMapping=It;let u=this.fsQuad;for(let f=0,c=m;f<c;f++){let h=l[f];h&&(h.matrixAutoUpdate=!1,h.matrix.identity(),u.material.map=h,u.material.transparent=!0,e.setRenderTarget(this,f),u.render(e),h.updateMatrix(),h.matrixAutoUpdate=!0)}u.material.map=null,e.setClearColor(Vs,a),e.setRenderTarget(n),e.toneMapping=i}dispose(){super.dispose(),this.fsQuad.dispose()}}});var qs,Xs=A(()=>{qs=`

	struct PhysicalCamera {

		float focusDistance;
		float anamorphicRatio;
		float bokehSize;
		int apertureBlades;
		float apertureRotation;

	};

`});var Ys,$s=A(()=>{Ys=`

	struct EquirectHdrInfo {

		sampler2D marginalWeights;
		sampler2D conditionalWeights;
		sampler2D map;

		float totalSum;

	};

`});var js,Ks=A(()=>{js=`

	#define RECT_AREA_LIGHT_TYPE 0
	#define CIRC_AREA_LIGHT_TYPE 1
	#define SPOT_LIGHT_TYPE 2
	#define DIR_LIGHT_TYPE 3
	#define POINT_LIGHT_TYPE 4

	struct LightsInfo {

		sampler2D tex;
		uint count;

	};

	struct Light {

		vec3 position;
		int type;

		vec3 color;
		float intensity;

		vec3 u;
		vec3 v;
		float area;

		// spot light fields
		float radius;
		float near;
		float decay;
		float distance;
		float coneCos;
		float penumbraCos;
		int iesProfile;

	};

	Light readLightInfo( sampler2D tex, uint index ) {

		uint i = index * 6u;

		vec4 s0 = texelFetch1D( tex, i + 0u );
		vec4 s1 = texelFetch1D( tex, i + 1u );
		vec4 s2 = texelFetch1D( tex, i + 2u );
		vec4 s3 = texelFetch1D( tex, i + 3u );

		Light l;
		l.position = s0.rgb;
		l.type = int( round( s0.a ) );

		l.color = s1.rgb;
		l.intensity = s1.a;

		l.u = s2.rgb;
		l.v = s3.rgb;
		l.area = s3.a;

		if ( l.type == SPOT_LIGHT_TYPE || l.type == POINT_LIGHT_TYPE ) {

			vec4 s4 = texelFetch1D( tex, i + 4u );
			vec4 s5 = texelFetch1D( tex, i + 5u );
			l.radius = s4.r;
			l.near = s4.g;
			l.decay = s4.b;
			l.distance = s4.a;

			l.coneCos = s5.r;
			l.penumbraCos = s5.g;
			l.iesProfile = int( round( s5.b ) );

		} else {

			l.radius = 0.0;
			l.near = 0.0;
			l.decay = 0.0;
			l.distance = 0.0;

			l.coneCos = 0.0;
			l.penumbraCos = 0.0;
			l.iesProfile = - 1;

		}

		return l;

	}

`});var Qs,Zs=A(()=>{Qs=`

	struct Material {

		vec3 color;
		int map;

		float metalness;
		int metalnessMap;

		float roughness;
		int roughnessMap;

		float ior;
		float transmission;
		int transmissionMap;

		float emissiveIntensity;
		vec3 emissive;
		int emissiveMap;

		int normalMap;
		vec2 normalScale;

		float clearcoat;
		int clearcoatMap;
		int clearcoatNormalMap;
		vec2 clearcoatNormalScale;
		float clearcoatRoughness;
		int clearcoatRoughnessMap;

		int iridescenceMap;
		int iridescenceThicknessMap;
		float iridescence;
		float iridescenceIor;
		float iridescenceThicknessMinimum;
		float iridescenceThicknessMaximum;

		vec3 specularColor;
		int specularColorMap;

		float specularIntensity;
		int specularIntensityMap;
		bool thinFilm;

		vec3 attenuationColor;
		float attenuationDistance;

		int alphaMap;

		bool castShadow;
		float opacity;
		float alphaTest;

		float side;
		bool matte;

		float sheen;
		vec3 sheenColor;
		int sheenColorMap;
		float sheenRoughness;
		int sheenRoughnessMap;

		bool vertexColors;
		bool flatShading;
		bool transparent;
		bool fogVolume;

		mat3 mapTransform;
		mat3 metalnessMapTransform;
		mat3 roughnessMapTransform;
		mat3 transmissionMapTransform;
		mat3 emissiveMapTransform;
		mat3 normalMapTransform;
		mat3 clearcoatMapTransform;
		mat3 clearcoatNormalMapTransform;
		mat3 clearcoatRoughnessMapTransform;
		mat3 sheenColorMapTransform;
		mat3 sheenRoughnessMapTransform;
		mat3 iridescenceMapTransform;
		mat3 iridescenceThicknessMapTransform;
		mat3 specularColorMapTransform;
		mat3 specularIntensityMapTransform;

	};

	mat3 readTextureTransform( sampler2D tex, uint index ) {

		mat3 textureTransform;

		vec4 row1 = texelFetch1D( tex, index );
		vec4 row2 = texelFetch1D( tex, index + 1u );

		textureTransform[0] = vec3(row1.r, row2.r, 0.0);
		textureTransform[1] = vec3(row1.g, row2.g, 0.0);
		textureTransform[2] = vec3(row1.b, row2.b, 1.0);

		return textureTransform;

	}

	Material readMaterialInfo( sampler2D tex, uint index ) {

		uint i = index * 45u;

		vec4 s0 = texelFetch1D( tex, i + 0u );
		vec4 s1 = texelFetch1D( tex, i + 1u );
		vec4 s2 = texelFetch1D( tex, i + 2u );
		vec4 s3 = texelFetch1D( tex, i + 3u );
		vec4 s4 = texelFetch1D( tex, i + 4u );
		vec4 s5 = texelFetch1D( tex, i + 5u );
		vec4 s6 = texelFetch1D( tex, i + 6u );
		vec4 s7 = texelFetch1D( tex, i + 7u );
		vec4 s8 = texelFetch1D( tex, i + 8u );
		vec4 s9 = texelFetch1D( tex, i + 9u );
		vec4 s10 = texelFetch1D( tex, i + 10u );
		vec4 s11 = texelFetch1D( tex, i + 11u );
		vec4 s12 = texelFetch1D( tex, i + 12u );
		vec4 s13 = texelFetch1D( tex, i + 13u );
		vec4 s14 = texelFetch1D( tex, i + 14u );

		Material m;
		m.color = s0.rgb;
		m.map = int( round( s0.a ) );

		m.metalness = s1.r;
		m.metalnessMap = int( round( s1.g ) );
		m.roughness = s1.b;
		m.roughnessMap = int( round( s1.a ) );

		m.ior = s2.r;
		m.transmission = s2.g;
		m.transmissionMap = int( round( s2.b ) );
		m.emissiveIntensity = s2.a;

		m.emissive = s3.rgb;
		m.emissiveMap = int( round( s3.a ) );

		m.normalMap = int( round( s4.r ) );
		m.normalScale = s4.gb;

		m.clearcoat = s4.a;
		m.clearcoatMap = int( round( s5.r ) );
		m.clearcoatRoughness = s5.g;
		m.clearcoatRoughnessMap = int( round( s5.b ) );
		m.clearcoatNormalMap = int( round( s5.a ) );
		m.clearcoatNormalScale = s6.rg;

		m.sheen = s6.a;
		m.sheenColor = s7.rgb;
		m.sheenColorMap = int( round( s7.a ) );
		m.sheenRoughness = s8.r;
		m.sheenRoughnessMap = int( round( s8.g ) );

		m.iridescenceMap = int( round( s8.b ) );
		m.iridescenceThicknessMap = int( round( s8.a ) );
		m.iridescence = s9.r;
		m.iridescenceIor = s9.g;
		m.iridescenceThicknessMinimum = s9.b;
		m.iridescenceThicknessMaximum = s9.a;

		m.specularColor = s10.rgb;
		m.specularColorMap = int( round( s10.a ) );

		m.specularIntensity = s11.r;
		m.specularIntensityMap = int( round( s11.g ) );
		m.thinFilm = bool( s11.b );

		m.attenuationColor = s12.rgb;
		m.attenuationDistance = s12.a;

		m.alphaMap = int( round( s13.r ) );

		m.opacity = s13.g;
		m.alphaTest = s13.b;
		m.side = s13.a;

		m.matte = bool( s14.r );
		m.castShadow = ! bool( s14.g );
		m.vertexColors = bool( int( s14.b ) & 1 );
		m.flatShading = bool( int( s14.b ) & 2 );
		m.fogVolume = bool( int( s14.b ) & 4 );
		m.transparent = bool( s14.a );

		uint firstTextureTransformIdx = i + 15u;

		// mat3( 1.0 ) is an identity matrix
		m.mapTransform = m.map == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx );
		m.metalnessMapTransform = m.metalnessMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 2u );
		m.roughnessMapTransform = m.roughnessMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 4u );
		m.transmissionMapTransform = m.transmissionMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 6u );
		m.emissiveMapTransform = m.emissiveMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 8u );
		m.normalMapTransform = m.normalMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 10u );
		m.clearcoatMapTransform = m.clearcoatMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 12u );
		m.clearcoatNormalMapTransform = m.clearcoatNormalMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 14u );
		m.clearcoatRoughnessMapTransform = m.clearcoatRoughnessMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 16u );
		m.sheenColorMapTransform = m.sheenColorMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 18u );
		m.sheenRoughnessMapTransform = m.sheenRoughnessMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 20u );
		m.iridescenceMapTransform = m.iridescenceMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 22u );
		m.iridescenceThicknessMapTransform = m.iridescenceThicknessMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 24u );
		m.specularColorMapTransform = m.specularColorMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 26u );
		m.specularIntensityMapTransform = m.specularIntensityMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 28u );

		return m;

	}

`});var Js,en=A(()=>{Js=`

#ifndef FOG_CHECK_ITERATIONS
#define FOG_CHECK_ITERATIONS 30
#endif

// returns whether the given material is a fog material or not
bool isMaterialFogVolume( sampler2D materials, uint materialIndex ) {

	uint i = materialIndex * 45u;
	vec4 s14 = texelFetch1D( materials, i + 14u );
	return bool( int( s14.b ) & 4 );

}

// returns true if we're within the first fog volume we hit
bool bvhIntersectFogVolumeHit(
	vec3 rayOrigin, vec3 rayDirection,
	usampler2D materialIndexAttribute, sampler2D materials,
	inout Material material
) {

	material.fogVolume = false;

	for ( int i = 0; i < FOG_CHECK_ITERATIONS; i ++ ) {

		// find nearest hit
		uvec4 faceIndices = uvec4( 0u );
		vec3 faceNormal = vec3( 0.0, 0.0, 1.0 );
		vec3 barycoord = vec3( 0.0 );
		float side = 1.0;
		float dist = 0.0;
		bool hit = bvhIntersectFirstHit( bvh, rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, dist );
		if ( hit ) {

			// if it's a fog volume return whether we hit the front or back face
			uint materialIndex = uTexelFetch1D( materialIndexAttribute, faceIndices.x ).r;
			if ( isMaterialFogVolume( materials, materialIndex ) ) {

				material = readMaterialInfo( materials, materialIndex );
				return side == - 1.0;

			} else {

				// move the ray forward
				rayOrigin = stepRayOrigin( rayOrigin, rayDirection, - faceNormal, dist );

			}

		} else {

			return false;

		}

	}

	return false;

}

`});var tn,rn=A(()=>{tn=`

	// The GGX functions provide sampling and distribution information for normals as output so
	// in order to get probability of scatter direction the half vector must be computed and provided.
	// [0] https://www.cs.cornell.edu/~srm/publications/EGSR07-btdf.pdf
	// [1] https://hal.archives-ouvertes.fr/hal-01509746/document
	// [2] http://jcgt.org/published/0007/04/01/
	// [4] http://jcgt.org/published/0003/02/03/

	// trowbridge-reitz === GGX === GTR

	vec3 ggxDirection( vec3 incidentDir, vec2 roughness, vec2 uv ) {

		// TODO: try GGXVNDF implementation from reference [2], here. Needs to update ggxDistribution
		// function below, as well

		// Implementation from reference [1]
		// stretch view
		vec3 V = normalize( vec3( roughness * incidentDir.xy, incidentDir.z ) );

		// orthonormal basis
		vec3 T1 = ( V.z < 0.9999 ) ? normalize( cross( V, vec3( 0.0, 0.0, 1.0 ) ) ) : vec3( 1.0, 0.0, 0.0 );
		vec3 T2 = cross( T1, V );

		// sample point with polar coordinates (r, phi)
		float a = 1.0 / ( 1.0 + V.z );
		float r = sqrt( uv.x );
		float phi = ( uv.y < a ) ? uv.y / a * PI : PI + ( uv.y - a ) / ( 1.0 - a ) * PI;
		float P1 = r * cos( phi );
		float P2 = r * sin( phi ) * ( ( uv.y < a ) ? 1.0 : V.z );

		// compute normal
		vec3 N = P1 * T1 + P2 * T2 + V * sqrt( max( 0.0, 1.0 - P1 * P1 - P2 * P2 ) );

		// unstretch
		N = normalize( vec3( roughness * N.xy, max( 0.0, N.z ) ) );

		return N;

	}

	// Below are PDF and related functions for use in a Monte Carlo path tracer
	// as specified in Appendix B of the following paper
	// See equation (34) from reference [0]
	float ggxLamda( float theta, float roughness ) {

		float tanTheta = tan( theta );
		float tanTheta2 = tanTheta * tanTheta;
		float alpha2 = roughness * roughness;

		float numerator = - 1.0 + sqrt( 1.0 + alpha2 * tanTheta2 );
		return numerator / 2.0;

	}

	// See equation (34) from reference [0]
	float ggxShadowMaskG1( float theta, float roughness ) {

		return 1.0 / ( 1.0 + ggxLamda( theta, roughness ) );

	}

	// See equation (125) from reference [4]
	float ggxShadowMaskG2( vec3 wi, vec3 wo, float roughness ) {

		float incidentTheta = acos( wi.z );
		float scatterTheta = acos( wo.z );
		return 1.0 / ( 1.0 + ggxLamda( incidentTheta, roughness ) + ggxLamda( scatterTheta, roughness ) );

	}

	// See equation (33) from reference [0]
	float ggxDistribution( vec3 halfVector, float roughness ) {

		float a2 = roughness * roughness;
		a2 = max( EPSILON, a2 );
		float cosTheta = halfVector.z;
		float cosTheta4 = pow( cosTheta, 4.0 );

		if ( cosTheta == 0.0 ) return 0.0;

		float theta = acosSafe( halfVector.z );
		float tanTheta = tan( theta );
		float tanTheta2 = pow( tanTheta, 2.0 );

		float denom = PI * cosTheta4 * pow( a2 + tanTheta2, 2.0 );
		return ( a2 / denom );

	}

	// See equation (3) from reference [2]
	float ggxPDF( vec3 wi, vec3 halfVector, float roughness ) {

		float incidentTheta = acos( wi.z );
		float D = ggxDistribution( halfVector, roughness );
		float G1 = ggxShadowMaskG1( incidentTheta, roughness );

		return D * G1 * max( 0.0, dot( wi, halfVector ) ) / wi.z;

	}

`});var on,sn=A(()=>{on=`

	// See equation (2) in http://www.aconty.com/pdf/s2017_pbs_imageworks_sheen.pdf
	float velvetD( float cosThetaH, float roughness ) {

		float alpha = max( roughness, 0.07 );
		alpha = alpha * alpha;

		float invAlpha = 1.0 / alpha;

		float sqrCosThetaH = cosThetaH * cosThetaH;
		float sinThetaH = max( 1.0 - sqrCosThetaH, 0.001 );

		return ( 2.0 + invAlpha ) * pow( sinThetaH, 0.5 * invAlpha ) / ( 2.0 * PI );

	}

	float velvetParamsInterpolate( int i, float oneMinusAlphaSquared ) {

		const float p0[5] = float[5]( 25.3245, 3.32435, 0.16801, -1.27393, -4.85967 );
		const float p1[5] = float[5]( 21.5473, 3.82987, 0.19823, -1.97760, -4.32054 );

		return mix( p1[i], p0[i], oneMinusAlphaSquared );

	}

	float velvetL( float x, float alpha ) {

		float oneMinusAlpha = 1.0 - alpha;
		float oneMinusAlphaSquared = oneMinusAlpha * oneMinusAlpha;

		float a = velvetParamsInterpolate( 0, oneMinusAlphaSquared );
		float b = velvetParamsInterpolate( 1, oneMinusAlphaSquared );
		float c = velvetParamsInterpolate( 2, oneMinusAlphaSquared );
		float d = velvetParamsInterpolate( 3, oneMinusAlphaSquared );
		float e = velvetParamsInterpolate( 4, oneMinusAlphaSquared );

		return a / ( 1.0 + b * pow( abs( x ), c ) ) + d * x + e;

	}

	// See equation (3) in http://www.aconty.com/pdf/s2017_pbs_imageworks_sheen.pdf
	float velvetLambda( float cosTheta, float alpha ) {

		return abs( cosTheta ) < 0.5 ? exp( velvetL( cosTheta, alpha ) ) : exp( 2.0 * velvetL( 0.5, alpha ) - velvetL( 1.0 - cosTheta, alpha ) );

	}

	// See Section 3, Shadowing Term, in http://www.aconty.com/pdf/s2017_pbs_imageworks_sheen.pdf
	float velvetG( float cosThetaO, float cosThetaI, float roughness ) {

		float alpha = max( roughness, 0.07 );
		alpha = alpha * alpha;

		return 1.0 / ( 1.0 + velvetLambda( cosThetaO, alpha ) + velvetLambda( cosThetaI, alpha ) );

	}

	float directionalAlbedoSheen( float cosTheta, float alpha ) {

		cosTheta = saturate( cosTheta );

		float c = 1.0 - cosTheta;
		float c3 = c * c * c;

		return 0.65584461 * c3 + 1.0 / ( 4.16526551 + exp( -7.97291361 * sqrt( alpha ) + 6.33516894 ) );

	}

	float sheenAlbedoScaling( vec3 wo, vec3 wi, SurfaceRecord surf ) {

		float alpha = max( surf.sheenRoughness, 0.07 );
		alpha = alpha * alpha;

		float maxSheenColor = max( max( surf.sheenColor.r, surf.sheenColor.g ), surf.sheenColor.b );

		float eWo = directionalAlbedoSheen( saturateCos( wo.z ), alpha );
		float eWi = directionalAlbedoSheen( saturateCos( wi.z ), alpha );

		return min( 1.0 - maxSheenColor * eWo, 1.0 - maxSheenColor * eWi );

	}

	// See Section 5, Layering, in http://www.aconty.com/pdf/s2017_pbs_imageworks_sheen.pdf
	float sheenAlbedoScaling( vec3 wo, SurfaceRecord surf ) {

		float alpha = max( surf.sheenRoughness, 0.07 );
		alpha = alpha * alpha;

		float maxSheenColor = max( max( surf.sheenColor.r, surf.sheenColor.g ), surf.sheenColor.b );

		float eWo = directionalAlbedoSheen( saturateCos( wo.z ), alpha );

		return 1.0 - maxSheenColor * eWo;

	}

`});var nn,an=A(()=>{nn=`

	// XYZ to sRGB color space
	const mat3 XYZ_TO_REC709 = mat3(
		3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);

	vec3 fresnel0ToIor( vec3 fresnel0 ) {

		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );

	}

	// Conversion FO/IOR
	vec3 iorToFresnel0( vec3 transmittedIor, float incidentIor ) {

		return square( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );

	}

	// ior is a value between 1.0 and 3.0. 1.0 is air interface
	float iorToFresnel0( float transmittedIor, float incidentIor ) {

		return square( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ) );

	}

	// Fresnel equations for dielectric/dielectric interfaces. See https://belcour.github.io/blog/research/2017/05/01/brdf-thin-film.html
	vec3 evalSensitivity( float OPD, vec3 shift ) {

		float phase = 2.0 * PI * OPD * 1.0e-9;

		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );

		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - square( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * square( phase ) );
		xyz /= 1.0685e-7;

		vec3 srgb = XYZ_TO_REC709 * xyz;
		return srgb;

	}

	// See Section 4. Analytic Spectral Integration, A Practical Extension to Microfacet Theory for the Modeling of Varying Iridescence, https://hal.archives-ouvertes.fr/hal-01518344/document
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {

		vec3 I;

		// Force iridescenceIor -> outsideIOR when thinFilmThickness -> 0.0
		float iridescenceIor = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );

		// Evaluate the cosTheta on the base layer (Snell law)
		float sinTheta2Sq = square( outsideIOR / iridescenceIor ) * ( 1.0 - square( cosTheta1 ) );

		// Handle TIR:
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {

			return vec3( 1.0 );

		}

		float cosTheta2 = sqrt( cosTheta2Sq );

		// First interface
		float R0 = iorToFresnel0( iridescenceIor, outsideIOR );
		float R12 = schlickFresnel( cosTheta1, R0 );
		float R21 = R12;
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIor < outsideIOR ) {

			phi12 = PI;

		}

		float phi21 = PI - phi12;

		// Second interface
		vec3 baseIOR = fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) ); // guard against 1.0
		vec3 R1 = iorToFresnel0( baseIOR, iridescenceIor );
		vec3 R23 = schlickFresnel( cosTheta2, R1 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[0] < iridescenceIor ) {

			phi23[ 0 ] = PI;

		}

		if ( baseIOR[1] < iridescenceIor ) {

			phi23[ 1 ] = PI;

		}

		if ( baseIOR[2] < iridescenceIor ) {

			phi23[ 2 ] = PI;

		}

		// Phase shift
		float OPD = 2.0 * iridescenceIor * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;

		// Compound terms
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = square( T121 ) * R23 / ( vec3( 1.0 ) - R123 );

		// Reflectance term for m = 0 (DC term amplitude)
		vec3 C0 = R12 + Rs;
		I = C0;

		// Reflectance term for m > 0 (pairs of diracs)
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {

			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;

		}

		// Since out of gamut colors might be produced, negative color values are clamped to 0.
		return max( I, vec3( 0.0 ) );

	}

`});var ln,cn=A(()=>{rn();sn();an();ln=`

	struct SurfaceRecord {

		// surface type
		bool volumeParticle;

		// geometry
		vec3 faceNormal;
		bool frontFace;
		vec3 normal;
		mat3 normalBasis;
		mat3 normalInvBasis;

		// cached properties
		float eta;
		float f0;

		// material
		float roughness;
		float filteredRoughness;
		float metalness;
		vec3 color;
		vec3 emission;

		// transmission
		float ior;
		float transmission;
		bool thinFilm;
		vec3 attenuationColor;
		float attenuationDistance;

		// clearcoat
		vec3 clearcoatNormal;
		mat3 clearcoatBasis;
		mat3 clearcoatInvBasis;
		float clearcoat;
		float clearcoatRoughness;
		float filteredClearcoatRoughness;

		// sheen
		float sheen;
		vec3 sheenColor;
		float sheenRoughness;

		// iridescence
		float iridescence;
		float iridescenceIor;
		float iridescenceThickness;

		// specular
		vec3 specularColor;
		float specularIntensity;
	};

	struct ScatterRecord {
		float specularPdf;
		float pdf;
		vec3 direction;
		vec3 color;
	};

	${tn}
	${on}
	${nn}

	// diffuse
	float diffuseEval( vec3 wo, vec3 wi, vec3 wh, SurfaceRecord surf, inout vec3 color ) {

		// https://schuttejoe.github.io/post/disneybsdf/
		float fl = schlickFresnel( wi.z, 0.0 );
		float fv = schlickFresnel( wo.z, 0.0 );

		float metalFactor = ( 1.0 - surf.metalness );
		float transFactor = ( 1.0 - surf.transmission );
		float rr = 0.5 + 2.0 * surf.roughness * fl * fl;
		float retro = rr * ( fl + fv + fl * fv * ( rr - 1.0f ) );
		float lambert = ( 1.0f - 0.5f * fl ) * ( 1.0f - 0.5f * fv );

		// TODO: subsurface approx?

		float F = evaluateFresnelWeight( dot( wo, wh ), surf.eta, surf.f0 );
		color = ( 1.0 - F ) * transFactor * metalFactor * wi.z * surf.color * ( retro + lambert ) / PI;
		return wi.z / PI;

	}

	vec3 diffuseDirection( vec3 wo, SurfaceRecord surf ) {

		vec3 lightDirection = sampleSphere( sobol2( 11 ) );
		lightDirection.z += 1.0;
		lightDirection = normalize( lightDirection );

		return lightDirection;

	}

	// specular
	float specularEval( vec3 wo, vec3 wi, vec3 wh, SurfaceRecord surf, inout vec3 color ) {

		// if roughness is set to 0 then D === NaN which results in black pixels
		float metalness = surf.metalness;
		float roughness = surf.filteredRoughness;

		float eta = surf.eta;
		float f0 = surf.f0;

		vec3 f0Color = mix( f0 * surf.specularColor * surf.specularIntensity, surf.color, surf.metalness );
		vec3 f90Color = vec3( mix( surf.specularIntensity, 1.0, surf.metalness ) );
		vec3 F = evaluateFresnel( dot( wo, wh ), eta, f0Color, f90Color );

		vec3 iridescenceF = evalIridescence( 1.0, surf.iridescenceIor, dot( wi, wh ), surf.iridescenceThickness, f0Color );
		F = mix( F, iridescenceF,  surf.iridescence );

		// PDF
		// See 14.1.1 Microfacet BxDFs in https://www.pbr-book.org/
		float incidentTheta = acos( wo.z );
		float G = ggxShadowMaskG2( wi, wo, roughness );
		float D = ggxDistribution( wh, roughness );
		float G1 = ggxShadowMaskG1( incidentTheta, roughness );
		float ggxPdf = D * G1 * max( 0.0, abs( dot( wo, wh ) ) ) / abs ( wo.z );

		color = wi.z * F * G * D / ( 4.0 * abs( wi.z * wo.z ) );
		return ggxPdf / ( 4.0 * dot( wo, wh ) );

	}

	vec3 specularDirection( vec3 wo, SurfaceRecord surf ) {

		// sample ggx vndf distribution which gives a new normal
		float roughness = surf.filteredRoughness;
		vec3 halfVector = ggxDirection(
			wo,
			vec2( roughness ),
			sobol2( 12 )
		);

		// apply to new ray by reflecting off the new normal
		return - reflect( wo, halfVector );

	}


	// transmission
	/*
	float transmissionEval( vec3 wo, vec3 wi, vec3 wh, SurfaceRecord surf, inout vec3 color ) {

		// See section 4.2 in https://www.cs.cornell.edu/~srm/publications/EGSR07-btdf.pdf

		float filteredRoughness = surf.filteredRoughness;
		float eta = surf.eta;
		bool frontFace = surf.frontFace;
		bool thinFilm = surf.thinFilm;

		color = surf.transmission * surf.color;

		float denom = pow( eta * dot( wi, wh ) + dot( wo, wh ), 2.0 );
		return ggxPDF( wo, wh, filteredRoughness ) / denom;

	}

	vec3 transmissionDirection( vec3 wo, SurfaceRecord surf ) {

		float filteredRoughness = surf.filteredRoughness;
		float eta = surf.eta;
		bool frontFace = surf.frontFace;

		// sample ggx vndf distribution which gives a new normal
		vec3 halfVector = ggxDirection(
			wo,
			vec2( filteredRoughness ),
			sobol2( 13 )
		);

		vec3 lightDirection = refract( normalize( - wo ), halfVector, eta );
		if ( surf.thinFilm ) {

			lightDirection = - refract( normalize( - lightDirection ), - vec3( 0.0, 0.0, 1.0 ), 1.0 / eta );

		}

		return normalize( lightDirection );

	}
	*/

	// TODO: This is just using a basic cosine-weighted specular distribution with an
	// incorrect PDF value at the moment. Update it to correctly use a GGX distribution
	float transmissionEval( vec3 wo, vec3 wi, vec3 wh, SurfaceRecord surf, inout vec3 color ) {

		color = surf.transmission * surf.color;

		// PDF
		float F = evaluateFresnelWeight( dot( wo, wh ), surf.eta, surf.f0 );
		if ( F >= 1.0 ) {

			return 0.0;

		}

		return 1.0 / ( 1.0 - F );

	}

	vec3 transmissionDirection( vec3 wo, SurfaceRecord surf ) {

		float roughness = surf.filteredRoughness;
		float eta = surf.eta;
		vec3 halfVector = normalize( vec3( 0.0, 0.0, 1.0 ) + sampleSphere( sobol2( 13 ) ) * roughness );
		vec3 lightDirection = refract( normalize( - wo ), halfVector, eta );

		if ( surf.thinFilm ) {

			lightDirection = - refract( normalize( - lightDirection ), - vec3( 0.0, 0.0, 1.0 ), 1.0 / eta );

		}
		return normalize( lightDirection );

	}

	// clearcoat
	float clearcoatEval( vec3 wo, vec3 wi, vec3 wh, SurfaceRecord surf, inout vec3 color ) {

		float ior = 1.5;
		float f0 = iorRatioToF0( ior );
		bool frontFace = surf.frontFace;
		float roughness = surf.filteredClearcoatRoughness;

		float eta = frontFace ? 1.0 / ior : ior;
		float G = ggxShadowMaskG2( wi, wo, roughness );
		float D = ggxDistribution( wh, roughness );
		float F = schlickFresnel( dot( wi, wh ), f0 );

		float fClearcoat = F * D * G / ( 4.0 * abs( wi.z * wo.z ) );
		color = color * ( 1.0 - surf.clearcoat * F ) + fClearcoat * surf.clearcoat * wi.z;

		// PDF
		// See equation (27) in http://jcgt.org/published/0003/02/03/
		return ggxPDF( wo, wh, roughness ) / ( 4.0 * dot( wi, wh ) );

	}

	vec3 clearcoatDirection( vec3 wo, SurfaceRecord surf ) {

		// sample ggx vndf distribution which gives a new normal
		float roughness = surf.filteredClearcoatRoughness;
		vec3 halfVector = ggxDirection(
			wo,
			vec2( roughness ),
			sobol2( 14 )
		);

		// apply to new ray by reflecting off the new normal
		return - reflect( wo, halfVector );

	}

	// sheen
	vec3 sheenColor( vec3 wo, vec3 wi, vec3 wh, SurfaceRecord surf ) {

		float cosThetaO = saturateCos( wo.z );
		float cosThetaI = saturateCos( wi.z );
		float cosThetaH = wh.z;

		float D = velvetD( cosThetaH, surf.sheenRoughness );
		float G = velvetG( cosThetaO, cosThetaI, surf.sheenRoughness );

		// See equation (1) in http://www.aconty.com/pdf/s2017_pbs_imageworks_sheen.pdf
		vec3 color = surf.sheenColor;
		color *= D * G / ( 4.0 * abs( cosThetaO * cosThetaI ) );
		color *= wi.z;

		return color;

	}

	// bsdf
	void getLobeWeights(
		vec3 wo, vec3 wi, vec3 wh, vec3 clearcoatWo, SurfaceRecord surf,
		inout float diffuseWeight, inout float specularWeight, inout float transmissionWeight, inout float clearcoatWeight
	) {

		float metalness = surf.metalness;
		float transmission = surf.transmission;
		float fEstimate = evaluateFresnelWeight( dot( wo, wh ), surf.eta, surf.f0 );

		float transSpecularProb = mix( max( 0.25, fEstimate ), 1.0, metalness );
		float diffSpecularProb = 0.5 + 0.5 * metalness;

		diffuseWeight = ( 1.0 - transmission ) * ( 1.0 - diffSpecularProb );
		specularWeight = transmission * transSpecularProb + ( 1.0 - transmission ) * diffSpecularProb;
		transmissionWeight = transmission * ( 1.0 - transSpecularProb );
		clearcoatWeight = surf.clearcoat * schlickFresnel( clearcoatWo.z, 0.04 );

		float totalWeight = diffuseWeight + specularWeight + transmissionWeight + clearcoatWeight;
		diffuseWeight /= totalWeight;
		specularWeight /= totalWeight;
		transmissionWeight /= totalWeight;
		clearcoatWeight /= totalWeight;
	}

	float bsdfEval(
		vec3 wo, vec3 clearcoatWo, vec3 wi, vec3 clearcoatWi, SurfaceRecord surf,
		float diffuseWeight, float specularWeight, float transmissionWeight, float clearcoatWeight, inout float specularPdf, inout vec3 color
	) {

		float metalness = surf.metalness;
		float transmission = surf.transmission;

		float spdf = 0.0;
		float dpdf = 0.0;
		float tpdf = 0.0;
		float cpdf = 0.0;
		color = vec3( 0.0 );

		vec3 halfVector = getHalfVector( wi, wo, surf.eta );

		// diffuse
		if ( diffuseWeight > 0.0 && wi.z > 0.0 ) {

			dpdf = diffuseEval( wo, wi, halfVector, surf, color );
			color *= 1.0 - surf.transmission;

		}

		// ggx specular
		if ( specularWeight > 0.0 && wi.z > 0.0 ) {

			vec3 outColor;
			spdf = specularEval( wo, wi, getHalfVector( wi, wo ), surf, outColor );
			color += outColor;

		}

		// transmission
		if ( transmissionWeight > 0.0 && wi.z < 0.0 ) {

			tpdf = transmissionEval( wo, wi, halfVector, surf, color );

		}

		// sheen
		color *= mix( 1.0, sheenAlbedoScaling( wo, wi, surf ), surf.sheen );
		color += sheenColor( wo, wi, halfVector, surf ) * surf.sheen;

		// clearcoat
		if ( clearcoatWi.z >= 0.0 && clearcoatWeight > 0.0 ) {

			vec3 clearcoatHalfVector = getHalfVector( clearcoatWo, clearcoatWi );
			cpdf = clearcoatEval( clearcoatWo, clearcoatWi, clearcoatHalfVector, surf, color );

		}

		float pdf =
			dpdf * diffuseWeight
			+ spdf * specularWeight
			+ tpdf * transmissionWeight
			+ cpdf * clearcoatWeight;

		// retrieve specular rays for the shadows flag
		specularPdf = spdf * specularWeight + cpdf * clearcoatWeight;

		return pdf;

	}

	float bsdfResult( vec3 worldWo, vec3 worldWi, SurfaceRecord surf, inout vec3 color ) {

		if ( surf.volumeParticle ) {

			color = surf.color / ( 4.0 * PI );
			return 1.0 / ( 4.0 * PI );

		}

		vec3 wo = normalize( surf.normalInvBasis * worldWo );
		vec3 wi = normalize( surf.normalInvBasis * worldWi );

		vec3 clearcoatWo = normalize( surf.clearcoatInvBasis * worldWo );
		vec3 clearcoatWi = normalize( surf.clearcoatInvBasis * worldWi );

		vec3 wh = getHalfVector( wo, wi, surf.eta );
		float diffuseWeight;
		float specularWeight;
		float transmissionWeight;
		float clearcoatWeight;
		getLobeWeights( wo, wi, wh, clearcoatWo, surf, diffuseWeight, specularWeight, transmissionWeight, clearcoatWeight );

		float specularPdf;
		return bsdfEval( wo, clearcoatWo, wi, clearcoatWi, surf, diffuseWeight, specularWeight, transmissionWeight, clearcoatWeight, specularPdf, color );

	}

	ScatterRecord bsdfSample( vec3 worldWo, SurfaceRecord surf ) {

		if ( surf.volumeParticle ) {

			ScatterRecord sampleRec;
			sampleRec.specularPdf = 0.0;
			sampleRec.pdf = 1.0 / ( 4.0 * PI );
			sampleRec.direction = sampleSphere( sobol2( 16 ) );
			sampleRec.color = surf.color / ( 4.0 * PI );
			return sampleRec;

		}

		vec3 wo = normalize( surf.normalInvBasis * worldWo );
		vec3 clearcoatWo = normalize( surf.clearcoatInvBasis * worldWo );
		mat3 normalBasis = surf.normalBasis;
		mat3 invBasis = surf.normalInvBasis;
		mat3 clearcoatNormalBasis = surf.clearcoatBasis;
		mat3 clearcoatInvBasis = surf.clearcoatInvBasis;

		float diffuseWeight;
		float specularWeight;
		float transmissionWeight;
		float clearcoatWeight;
		// using normal and basically-reflected ray since we don't have proper half vector here
		getLobeWeights( wo, wo, vec3( 0, 0, 1 ), clearcoatWo, surf, diffuseWeight, specularWeight, transmissionWeight, clearcoatWeight );

		float pdf[4];
		pdf[0] = diffuseWeight;
		pdf[1] = specularWeight;
		pdf[2] = transmissionWeight;
		pdf[3] = clearcoatWeight;

		float cdf[4];
		cdf[0] = pdf[0];
		cdf[1] = pdf[1] + cdf[0];
		cdf[2] = pdf[2] + cdf[1];
		cdf[3] = pdf[3] + cdf[2];

		if( cdf[3] != 0.0 ) {

			float invMaxCdf = 1.0 / cdf[3];
			cdf[0] *= invMaxCdf;
			cdf[1] *= invMaxCdf;
			cdf[2] *= invMaxCdf;
			cdf[3] *= invMaxCdf;

		} else {

			cdf[0] = 1.0;
			cdf[1] = 0.0;
			cdf[2] = 0.0;
			cdf[3] = 0.0;

		}

		vec3 wi;
		vec3 clearcoatWi;

		float r = sobol( 15 );
		if ( r <= cdf[0] ) { // diffuse

			wi = diffuseDirection( wo, surf );
			clearcoatWi = normalize( clearcoatInvBasis * normalize( normalBasis * wi ) );

		} else if ( r <= cdf[1] ) { // specular

			wi = specularDirection( wo, surf );
			clearcoatWi = normalize( clearcoatInvBasis * normalize( normalBasis * wi ) );

		} else if ( r <= cdf[2] ) { // transmission / refraction

			wi = transmissionDirection( wo, surf );
			clearcoatWi = normalize( clearcoatInvBasis * normalize( normalBasis * wi ) );

		} else if ( r <= cdf[3] ) { // clearcoat

			clearcoatWi = clearcoatDirection( clearcoatWo, surf );
			wi = normalize( invBasis * normalize( clearcoatNormalBasis * clearcoatWi ) );

		}

		ScatterRecord result;
		result.pdf = bsdfEval( wo, clearcoatWo, wi, clearcoatWi, surf, diffuseWeight, specularWeight, transmissionWeight, clearcoatWeight, result.specularPdf, result.color );
		result.direction = normalize( surf.normalBasis * wi );

		return result;

	}

`});var un,fn=A(()=>{un=`

	// returns the hit distance given the material density
	float intersectFogVolume( Material material, float u ) {

		// https://raytracing.github.io/books/RayTracingTheNextWeek.html#volumes/constantdensitymediums
		return material.opacity == 0.0 ? INFINITY : ( - 1.0 / material.opacity ) * log( u );

	}

	ScatterRecord sampleFogVolume( SurfaceRecord surf, vec2 uv ) {

		ScatterRecord sampleRec;
		sampleRec.specularPdf = 0.0;
		sampleRec.pdf = 1.0 / ( 2.0 * PI );
		sampleRec.direction = sampleSphere( uv );
		sampleRec.color = surf.color;
		return sampleRec;

	}

`});var pn,mn=A(()=>{pn=`

	// samples the the given environment map in the given direction
	vec3 sampleEquirectColor( sampler2D envMap, vec3 direction ) {

		return texture2D( envMap, equirectDirectionToUv( direction ) ).rgb;

	}

	// gets the pdf of the given direction to sample
	float equirectDirectionPdf( vec3 direction ) {

		vec2 uv = equirectDirectionToUv( direction );
		float theta = uv.y * PI;
		float sinTheta = sin( theta );
		if ( sinTheta == 0.0 ) {

			return 0.0;

		}

		return 1.0 / ( 2.0 * PI * PI * sinTheta );

	}

	// samples the color given env map with CDF and returns the pdf of the direction
	float sampleEquirect( vec3 direction, inout vec3 color ) {

		vec2 uv = equirectDirectionToUv( direction );
		color = texture2D( envMapInfo.map, uv ).rgb;

		float totalSum = envMapInfo.totalSum;
		float lum = luminance( color );
		ivec2 resolution = textureSize( envMapInfo.map, 0 );
		float pdf = lum / totalSum;

		return float( resolution.x * resolution.y ) * pdf * equirectDirectionPdf( direction );

	}

	// samples a direction of the envmap with color and retrieves pdf
	float sampleEquirectProbability( vec2 r, inout vec3 color, inout vec3 direction ) {

		// sample env map cdf
		float v = texture2D( envMapInfo.marginalWeights, vec2( r.x, 0.0 ) ).x;
		float u = texture2D( envMapInfo.conditionalWeights, vec2( r.y, v ) ).x;
		vec2 uv = vec2( u, v );

		vec3 derivedDirection = equirectUvToDirection( uv );
		direction = derivedDirection;
		color = texture2D( envMapInfo.map, uv ).rgb;

		float totalSum = envMapInfo.totalSum;
		float lum = luminance( color );
		ivec2 resolution = textureSize( envMapInfo.map, 0 );
		float pdf = lum / totalSum;

		return float( resolution.x * resolution.y ) * pdf * equirectDirectionPdf( direction );

	}

`});var hn,dn=A(()=>{hn=`

	float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {

		return smoothstep( coneCosine, penumbraCosine, angleCosine );

	}

	float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {

		// based upon Frostbite 3 Moving to Physically-based Rendering
		// page 32, equation 26: E[window1]
		// https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf
		float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), EPSILON );

		if ( cutoffDistance > 0.0 ) {

			distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );

		}

		return distanceFalloff;

	}

	float getPhotometricAttenuation( sampler2DArray iesProfiles, int iesProfile, vec3 posToLight, vec3 lightDir, vec3 u, vec3 v ) {

		float cosTheta = dot( posToLight, lightDir );
		float angle = acos( cosTheta ) * ( 1.0 / PI );

		return texture2D( iesProfiles, vec3( 0.0, angle, iesProfile ) ).r;

	}

	struct LightRecord {

		float dist;
		vec3 direction;
		float pdf;
		vec3 emission;
		int type;

	};

	bool intersectLightAtIndex( sampler2D lights, vec3 rayOrigin, vec3 rayDirection, uint l, inout LightRecord lightRec ) {

		bool didHit = false;
		Light light = readLightInfo( lights, l );

		vec3 u = light.u;
		vec3 v = light.v;

		// check for backface
		vec3 normal = normalize( cross( u, v ) );
		if ( dot( normal, rayDirection ) > 0.0 ) {

			u *= 1.0 / dot( u, u );
			v *= 1.0 / dot( v, v );

			float dist;

			// MIS / light intersection is not supported for punctual lights.
			if(
				( light.type == RECT_AREA_LIGHT_TYPE && intersectsRectangle( light.position, normal, u, v, rayOrigin, rayDirection, dist ) ) ||
				( light.type == CIRC_AREA_LIGHT_TYPE && intersectsCircle( light.position, normal, u, v, rayOrigin, rayDirection, dist ) )
			) {

				float cosTheta = dot( rayDirection, normal );
				didHit = true;
				lightRec.dist = dist;
				lightRec.pdf = ( dist * dist ) / ( light.area * cosTheta );
				lightRec.emission = light.color * light.intensity;
				lightRec.direction = rayDirection;
				lightRec.type = light.type;

			}

		}

		return didHit;

	}

	LightRecord randomAreaLightSample( Light light, vec3 rayOrigin, vec2 ruv ) {

		vec3 randomPos;
		if( light.type == RECT_AREA_LIGHT_TYPE ) {

			// rectangular area light
			randomPos = light.position + light.u * ( ruv.x - 0.5 ) + light.v * ( ruv.y - 0.5 );

		} else if( light.type == CIRC_AREA_LIGHT_TYPE ) {

			// circular area light
			float r = 0.5 * sqrt( ruv.x );
			float theta = ruv.y * 2.0 * PI;
			float x = r * cos( theta );
			float y = r * sin( theta );

			randomPos = light.position + light.u * x + light.v * y;

		}

		vec3 toLight = randomPos - rayOrigin;
		float lightDistSq = dot( toLight, toLight );
		float dist = sqrt( lightDistSq );
		vec3 direction = toLight / dist;
		vec3 lightNormal = normalize( cross( light.u, light.v ) );

		LightRecord lightRec;
		lightRec.type = light.type;
		lightRec.emission = light.color * light.intensity;
		lightRec.dist = dist;
		lightRec.direction = direction;

		// TODO: the denominator is potentially zero
		lightRec.pdf = lightDistSq / ( light.area * dot( direction, lightNormal ) );

		return lightRec;

	}

	LightRecord randomSpotLightSample( Light light, sampler2DArray iesProfiles, vec3 rayOrigin, vec2 ruv ) {

		float radius = light.radius * sqrt( ruv.x );
		float theta = ruv.y * 2.0 * PI;
		float x = radius * cos( theta );
		float y = radius * sin( theta );

		vec3 u = light.u;
		vec3 v = light.v;
		vec3 normal = normalize( cross( u, v ) );

		float angle = acos( light.coneCos );
		float angleTan = tan( angle );
		float startDistance = light.radius / max( angleTan, EPSILON );

		vec3 randomPos = light.position - normal * startDistance + u * x + v * y;
		vec3 toLight = randomPos - rayOrigin;
		float lightDistSq = dot( toLight, toLight );
		float dist = sqrt( lightDistSq );

		vec3 direction = toLight / max( dist, EPSILON );
		float cosTheta = dot( direction, normal );

		float spotAttenuation = light.iesProfile != - 1 ?
			getPhotometricAttenuation( iesProfiles, light.iesProfile, direction, normal, u, v ) :
			getSpotAttenuation( light.coneCos, light.penumbraCos, cosTheta );

		float distanceAttenuation = getDistanceAttenuation( dist, light.distance, light.decay );
		LightRecord lightRec;
		lightRec.type = light.type;
		lightRec.dist = dist;
		lightRec.direction = direction;
		lightRec.emission = light.color * light.intensity * distanceAttenuation * spotAttenuation;
		lightRec.pdf = 1.0;

		return lightRec;

	}

	LightRecord randomLightSample( sampler2D lights, sampler2DArray iesProfiles, uint lightCount, vec3 rayOrigin, vec3 ruv ) {

		LightRecord result;

		// pick a random light
		uint l = uint( ruv.x * float( lightCount ) );
		Light light = readLightInfo( lights, l );

		if ( light.type == SPOT_LIGHT_TYPE ) {

			result = randomSpotLightSample( light, iesProfiles, rayOrigin, ruv.yz );

		} else if ( light.type == POINT_LIGHT_TYPE ) {

			vec3 lightRay = light.u - rayOrigin;
			float lightDist = length( lightRay );
			float cutoffDistance = light.distance;
			float distanceFalloff = 1.0 / max( pow( lightDist, light.decay ), 0.01 );
			if ( cutoffDistance > 0.0 ) {

				distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDist / cutoffDistance ) ) );

			}

			LightRecord rec;
			rec.direction = normalize( lightRay );
			rec.dist = length( lightRay );
			rec.pdf = 1.0;
			rec.emission = light.color * light.intensity * distanceFalloff;
			rec.type = light.type;
			result = rec;

		} else if ( light.type == DIR_LIGHT_TYPE ) {

			LightRecord rec;
			rec.dist = 1e10;
			rec.direction = light.u;
			rec.pdf = 1.0;
			rec.emission = light.color * light.intensity;
			rec.type = light.type;

			result = rec;

		} else {

			// sample the light
			result = randomAreaLightSample( light, rayOrigin, ruv.yz );

		}

		return result;

	}

`});var gn,xn=A(()=>{gn=`

	vec3 sampleHemisphere( vec3 n, vec2 uv ) {

		// https://www.rorydriscoll.com/2009/01/07/better-sampling/
		// https://graphics.pixar.com/library/OrthonormalB/paper.pdf
		float sign = n.z == 0.0 ? 1.0 : sign( n.z );
		float a = - 1.0 / ( sign + n.z );
		float b = n.x * n.y * a;
		vec3 b1 = vec3( 1.0 + sign * n.x * n.x * a, sign * b, - sign * n.x );
		vec3 b2 = vec3( b, sign + n.y * n.y * a, - n.y );

		float r = sqrt( uv.x );
		float theta = 2.0 * PI * uv.y;
		float x = r * cos( theta );
		float y = r * sin( theta );
		return x * b1 + y * b2 + sqrt( 1.0 - uv.x ) * n;

	}

	vec2 sampleTriangle( vec2 a, vec2 b, vec2 c, vec2 r ) {

		// get the edges of the triangle and the diagonal across the
		// center of the parallelogram
		vec2 e1 = a - b;
		vec2 e2 = c - b;
		vec2 diag = normalize( e1 + e2 );

		// pick the point in the parallelogram
		if ( r.x + r.y > 1.0 ) {

			r = vec2( 1.0 ) - r;

		}

		return e1 * r.x + e2 * r.y;

	}

	vec2 sampleCircle( vec2 uv ) {

		float angle = 2.0 * PI * uv.x;
		float radius = sqrt( uv.y );
		return vec2( cos( angle ), sin( angle ) ) * radius;

	}

	vec3 sampleSphere( vec2 uv ) {

		float u = ( uv.x - 0.5 ) * 2.0;
		float t = uv.y * PI * 2.0;
		float f = sqrt( 1.0 - u * u );

		return vec3( f * cos( t ), f * sin( t ), u );

	}

	vec2 sampleRegularPolygon( int sides, vec3 uvw ) {

		sides = max( sides, 3 );

		vec3 r = uvw;
		float anglePerSegment = 2.0 * PI / float( sides );
		float segment = floor( float( sides ) * r.x );

		float angle1 = anglePerSegment * segment;
		float angle2 = angle1 + anglePerSegment;
		vec2 a = vec2( sin( angle1 ), cos( angle1 ) );
		vec2 b = vec2( 0.0, 0.0 );
		vec2 c = vec2( sin( angle2 ), cos( angle2 ) );

		return sampleTriangle( a, b, c, r.yz );

	}

	// samples an aperture shape with the given number of sides. 0 means circle
	vec2 sampleAperture( int blades, vec3 uvw ) {

		return blades == 0 ?
			sampleCircle( uvw.xy ) :
			sampleRegularPolygon( blades, uvw );

	}


`});var Tn,bn=A(()=>{Tn=`

	// Finds the point where the ray intersects the plane defined by u and v and checks if this point
	// falls in the bounds of the rectangle on that same plane.
	// Plane intersection: https://lousodrome.net/blog/light/2020/07/03/intersection-of-a-ray-and-a-plane/
	bool intersectsRectangle( vec3 center, vec3 normal, vec3 u, vec3 v, vec3 rayOrigin, vec3 rayDirection, inout float dist ) {

		float t = dot( center - rayOrigin, normal ) / dot( rayDirection, normal );

		if ( t > EPSILON ) {

			vec3 p = rayOrigin + rayDirection * t;
			vec3 vi = p - center;

			// check if p falls inside the rectangle
			float a1 = dot( u, vi );
			if ( abs( a1 ) <= 0.5 ) {

				float a2 = dot( v, vi );
				if ( abs( a2 ) <= 0.5 ) {

					dist = t;
					return true;

				}

			}

		}

		return false;

	}

	// Finds the point where the ray intersects the plane defined by u and v and checks if this point
	// falls in the bounds of the circle on that same plane. See above URL for a description of the plane intersection algorithm.
	bool intersectsCircle( vec3 position, vec3 normal, vec3 u, vec3 v, vec3 rayOrigin, vec3 rayDirection, inout float dist ) {

		float t = dot( position - rayOrigin, normal ) / dot( rayDirection, normal );

		if ( t > EPSILON ) {

			vec3 hit = rayOrigin + rayDirection * t;
			vec3 vi = hit - position;

			float a1 = dot( u, vi );
			float a2 = dot( v, vi );

			if( length( vec2( a1, a2 ) ) <= 0.5 ) {

				dist = t;
				return true;

			}

		}

		return false;

	}

`});var vn,yn=A(()=>{vn=`

	// Fast arccos approximation used to remove banding artifacts caused by numerical errors in acos.
	// This is a cubic Lagrange interpolating polynomial for x = [-1, -1/2, 0, 1/2, 1].
	// For more information see: https://github.com/gkjohnson/three-gpu-pathtracer/pull/171#issuecomment-1152275248
	float acosApprox( float x ) {

		x = clamp( x, -1.0, 1.0 );
		return ( - 0.69813170079773212 * x * x - 0.87266462599716477 ) * x + 1.5707963267948966;

	}

	// An acos with input values bound to the range [-1, 1].
	float acosSafe( float x ) {

		return acos( clamp( x, -1.0, 1.0 ) );

	}

	float saturateCos( float val ) {

		return clamp( val, 0.001, 1.0 );

	}

	float square( float t ) {

		return t * t;

	}

	vec2 square( vec2 t ) {

		return t * t;

	}

	vec3 square( vec3 t ) {

		return t * t;

	}

	vec4 square( vec4 t ) {

		return t * t;

	}

	vec2 rotateVector( vec2 v, float t ) {

		float ac = cos( t );
		float as = sin( t );
		return vec2(
			v.x * ac - v.y * as,
			v.x * as + v.y * ac
		);

	}

	// forms a basis with the normal vector as Z
	mat3 getBasisFromNormal( vec3 normal ) {

		vec3 other;
		if ( abs( normal.x ) > 0.5 ) {

			other = vec3( 0.0, 1.0, 0.0 );

		} else {

			other = vec3( 1.0, 0.0, 0.0 );

		}

		vec3 ortho = normalize( cross( normal, other ) );
		vec3 ortho2 = normalize( cross( normal, ortho ) );
		return mat3( ortho2, ortho, normal );

	}

`});var En,Rn=A(()=>{En=`

	// TODO: possibly this should be renamed something related to material or path tracing logic

	#ifndef RAY_OFFSET
	#define RAY_OFFSET 1e-4
	#endif

	// adjust the hit point by the surface normal by a factor of some offset and the
	// maximum component-wise value of the current point to accommodate floating point
	// error as values increase.
	vec3 stepRayOrigin( vec3 rayOrigin, vec3 rayDirection, vec3 offset, float dist ) {

		vec3 point = rayOrigin + rayDirection * dist;
		vec3 absPoint = abs( point );
		float maxPoint = max( absPoint.x, max( absPoint.y, absPoint.z ) );
		return point + offset * ( maxPoint + 1.0 ) * RAY_OFFSET;

	}

	// https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_volume/README.md#attenuation
	vec3 transmissionAttenuation( float dist, vec3 attColor, float attDist ) {

		vec3 ot = - log( attColor ) / attDist;
		return exp( - ot * dist );

	}

	vec3 getHalfVector( vec3 wi, vec3 wo, float eta ) {

		// get the half vector - assuming if the light incident vector is on the other side
		// of the that it's transmissive.
		vec3 h;
		if ( wi.z > 0.0 ) {

			h = normalize( wi + wo );

		} else {

			// Scale by the ior ratio to retrieve the appropriate half vector
			// From Section 2.2 on computing the transmission half vector:
			// https://blog.selfshadow.com/publications/s2015-shading-course/burley/s2015_pbs_disney_bsdf_notes.pdf
			h = normalize( wi + wo * eta );

		}

		h *= sign( h.z );
		return h;

	}

	vec3 getHalfVector( vec3 a, vec3 b ) {

		return normalize( a + b );

	}

	// The discrepancy between interpolated surface normal and geometry normal can cause issues when a ray
	// is cast that is on the top side of the geometry normal plane but below the surface normal plane. If
	// we find a ray like that we ignore it to avoid artifacts.
	// This function returns if the direction is on the same side of both planes.
	bool isDirectionValid( vec3 direction, vec3 surfaceNormal, vec3 geometryNormal ) {

		bool aboveSurfaceNormal = dot( direction, surfaceNormal ) > 0.0;
		bool aboveGeometryNormal = dot( direction, geometryNormal ) > 0.0;
		return aboveSurfaceNormal == aboveGeometryNormal;

	}

	// ray sampling x and z are swapped to align with expected background view
	vec2 equirectDirectionToUv( vec3 direction ) {

		// from Spherical.setFromCartesianCoords
		vec2 uv = vec2( atan( direction.z, direction.x ), acos( direction.y ) );
		uv /= vec2( 2.0 * PI, PI );

		// apply adjustments to get values in range [0, 1] and y right side up
		uv.x += 0.5;
		uv.y = 1.0 - uv.y;
		return uv;

	}

	vec3 equirectUvToDirection( vec2 uv ) {

		// undo above adjustments
		uv.x -= 0.5;
		uv.y = 1.0 - uv.y;

		// from Vector3.setFromSphericalCoords
		float theta = uv.x * 2.0 * PI;
		float phi = uv.y * PI;

		float sinPhi = sin( phi );

		return vec3( sinPhi * cos( theta ), cos( phi ), sinPhi * sin( theta ) );

	}

	// power heuristic for multiple importance sampling
	float misHeuristic( float a, float b ) {

		float aa = a * a;
		float bb = b * b;
		return aa / ( aa + bb );

	}

	// tentFilter from Peter Shirley's 'Realistic Ray Tracing (2nd Edition)' book, pg. 60
	// erichlof/THREE.js-PathTracing-Renderer/
	float tentFilter( float x ) {

		return x < 0.5 ? sqrt( 2.0 * x ) - 1.0 : 1.0 - sqrt( 2.0 - ( 2.0 * x ) );

	}
`});var Sn,wn=A(()=>{Sn=`

	bool totalInternalReflection( float cosTheta, float eta ) {

		float sinTheta = sqrt( 1.0 - cosTheta * cosTheta );
		return eta * sinTheta > 1.0;

	}

	// https://google.github.io/filament/Filament.md.html#materialsystem/diffusebrdf
	float schlickFresnel( float cosine, float f0 ) {

		return f0 + ( 1.0 - f0 ) * pow( 1.0 - cosine, 5.0 );

	}

	vec3 schlickFresnel( float cosine, vec3 f0 ) {

		return f0 + ( 1.0 - f0 ) * pow( 1.0 - cosine, 5.0 );

	}

	vec3 schlickFresnel( float cosine, vec3 f0, vec3 f90 ) {

		return f0 + ( f90 - f0 ) * pow( 1.0 - cosine, 5.0 );

	}

	float dielectricFresnel( float cosThetaI, float eta ) {

		// https://schuttejoe.github.io/post/disneybsdf/
		float ni = eta;
		float nt = 1.0;

		// Check for total internal reflection
		float sinThetaISq = 1.0f - cosThetaI * cosThetaI;
		float sinThetaTSq = eta * eta * sinThetaISq;
		if( sinThetaTSq >= 1.0 ) {

			return 1.0;

		}

		float sinThetaT = sqrt( sinThetaTSq );

		float cosThetaT = sqrt( max( 0.0, 1.0f - sinThetaT * sinThetaT ) );
		float rParallel = ( ( nt * cosThetaI ) - ( ni * cosThetaT ) ) / ( ( nt * cosThetaI ) + ( ni * cosThetaT ) );
		float rPerpendicular = ( ( ni * cosThetaI ) - ( nt * cosThetaT ) ) / ( ( ni * cosThetaI ) + ( nt * cosThetaT ) );
		return ( rParallel * rParallel + rPerpendicular * rPerpendicular ) / 2.0;

	}

	// https://raytracing.github.io/books/RayTracingInOneWeekend.html#dielectrics/schlickapproximation
	float iorRatioToF0( float eta ) {

		return pow( ( 1.0 - eta ) / ( 1.0 + eta ), 2.0 );

	}

	vec3 evaluateFresnel( float cosTheta, float eta, vec3 f0, vec3 f90 ) {

		if ( totalInternalReflection( cosTheta, eta ) ) {

			return f90;

		}

		return schlickFresnel( cosTheta, f0, f90 );

	}

	float evaluateFresnelWeight( float cosTheta, float eta, float f0 ) {

		if ( totalInternalReflection( cosTheta, eta ) ) {

			return 1.0;

		}

		return schlickFresnel( cosTheta, f0 );

	}

	/*
	// https://schuttejoe.github.io/post/disneybsdf/
	float disneyFresnel( vec3 wo, vec3 wi, vec3 wh, float f0, float eta, float metalness ) {

		float dotHV = dot( wo, wh );
		float dotHL = dot( wi, wh );

		float dielectricFresnel = dielectricFresnel( abs( dotHV ), eta );
		float metallicFresnel = schlickFresnel( dotHL, f0 );

		return mix( dielectricFresnel, metallicFresnel, metalness );

	}
	*/
`});var An,_n=A(()=>{An=`

	// add texel fetch functions for texture arrays
	vec4 texelFetch1D( sampler2DArray tex, int layer, uint index ) {

		uint width = uint( textureSize( tex, 0 ).x );
		uvec2 uv;
		uv.x = index % width;
		uv.y = index / width;

		return texelFetch( tex, ivec3( uv, layer ), 0 );

	}

	vec4 textureSampleBarycoord( sampler2DArray tex, int layer, vec3 barycoord, uvec3 faceIndices ) {

		return
			barycoord.x * texelFetch1D( tex, layer, faceIndices.x ) +
			barycoord.y * texelFetch1D( tex, layer, faceIndices.y ) +
			barycoord.z * texelFetch1D( tex, layer, faceIndices.z );

	}

`});var Mn,Cn=A(()=>{Mn=`

	// https://www.shadertoy.com/view/wltcRS
	uvec4 WHITE_NOISE_SEED;

	void rng_initialize( vec2 p, int frame ) {

		// white noise seed
		WHITE_NOISE_SEED = uvec4( p, uint( frame ), uint( p.x ) + uint( p.y ) );

	}

	// https://www.pcg-random.org/
	void pcg4d( inout uvec4 v ) {

		v = v * 1664525u + 1013904223u;
		v.x += v.y * v.w;
		v.y += v.z * v.x;
		v.z += v.x * v.y;
		v.w += v.y * v.z;
		v = v ^ ( v >> 16u );
		v.x += v.y*v.w;
		v.y += v.z*v.x;
		v.z += v.x*v.y;
		v.w += v.y*v.z;

	}

	// returns [ 0, 1 ]
	float rand() {

		pcg4d( WHITE_NOISE_SEED );
		return float( WHITE_NOISE_SEED.x ) / float( 0xffffffffu );

	}

	vec2 rand2() {

		pcg4d( WHITE_NOISE_SEED );
		return vec2( WHITE_NOISE_SEED.xy ) / float(0xffffffffu);

	}

	vec3 rand3() {

		pcg4d( WHITE_NOISE_SEED );
		return vec3( WHITE_NOISE_SEED.xyz ) / float( 0xffffffffu );

	}

	vec4 rand4() {

		pcg4d( WHITE_NOISE_SEED );
		return vec4( WHITE_NOISE_SEED ) / float( 0xffffffffu );

	}
`});var Fn,In=A(()=>{Fn=`

	struct Ray {

		vec3 origin;
		vec3 direction;

	};

	struct SurfaceHit {

		uvec4 faceIndices;
		vec3 barycoord;
		vec3 faceNormal;
		float side;
		float dist;

	};

	struct RenderState {

		bool firstRay;
		bool transmissiveRay;
		bool isShadowRay;
		float accumulatedRoughness;
		int transmissiveTraversals;
		int traversals;
		uint depth;
		vec3 throughputColor;
		Material fogMaterial;

	};

	RenderState initRenderState() {

		RenderState result;
		result.firstRay = true;
		result.transmissiveRay = true;
		result.isShadowRay = false;
		result.accumulatedRoughness = 0.0;
		result.transmissiveTraversals = 0;
		result.traversals = 0;
		result.throughputColor = vec3( 1.0 );
		result.depth = 0u;
		result.fogMaterial.fogVolume = false;
		return result;

	}

`});var Hn,Bn=A(()=>{Hn=`

	vec3 ndcToRayOrigin( vec2 coord ) {

		vec4 rayOrigin4 = cameraWorldMatrix * invProjectionMatrix * vec4( coord, - 1.0, 1.0 );
		return rayOrigin4.xyz / rayOrigin4.w;
	}

	Ray getCameraRay() {

		vec2 ssd = vec2( 1.0 ) / resolution;

		// Jitter the camera ray by finding a uv coordinate at a random sample
		// around this pixel's UV coordinate for AA
		vec2 ruv = sobol2( 0 );
		vec2 jitteredUv = vUv + vec2( tentFilter( ruv.x ) * ssd.x, tentFilter( ruv.y ) * ssd.y );
		Ray ray;

		#if CAMERA_TYPE == 2

			// Equirectangular projection
			vec4 rayDirection4 = vec4( equirectUvToDirection( jitteredUv ), 0.0 );
			vec4 rayOrigin4 = vec4( 0.0, 0.0, 0.0, 1.0 );

			rayDirection4 = cameraWorldMatrix * rayDirection4;
			rayOrigin4 = cameraWorldMatrix * rayOrigin4;

			ray.direction = normalize( rayDirection4.xyz );
			ray.origin = rayOrigin4.xyz / rayOrigin4.w;

		#else

			// get [- 1, 1] normalized device coordinates
			vec2 ndc = 2.0 * jitteredUv - vec2( 1.0 );
			ray.origin = ndcToRayOrigin( ndc );

			#if CAMERA_TYPE == 1

				// Orthographic projection
				ray.direction = ( cameraWorldMatrix * vec4( 0.0, 0.0, - 1.0, 0.0 ) ).xyz;
				ray.direction = normalize( ray.direction );

			#else

				// Perspective projection
				ray.direction = normalize( mat3( cameraWorldMatrix ) * ( invProjectionMatrix * vec4( ndc, 0.0, 1.0 ) ).xyz );

			#endif

		#endif

		#if FEATURE_DOF
		{

			// depth of field
			vec3 focalPoint = ray.origin + normalize( ray.direction ) * physicalCamera.focusDistance;

			// get the aperture sample
			// if blades === 0 then we assume a circle
			vec3 shapeUVW= sobol3( 1 );
			int blades = physicalCamera.apertureBlades;
			float anamorphicRatio = physicalCamera.anamorphicRatio;
			vec2 apertureSample = blades == 0 ? sampleCircle( shapeUVW.xy ) : sampleRegularPolygon( blades, shapeUVW );
			apertureSample *= physicalCamera.bokehSize * 0.5 * 1e-3;

			// rotate the aperture shape
			apertureSample =
				rotateVector( apertureSample, physicalCamera.apertureRotation ) *
				saturate( vec2( anamorphicRatio, 1.0 / anamorphicRatio ) );

			// create the new ray
			ray.origin += ( cameraWorldMatrix * vec4( apertureSample, 0.0, 0.0 ) ).xyz;
			ray.direction = focalPoint - ray.origin;

		}
		#endif

		ray.direction = normalize( ray.direction );

		return ray;

	}

`});var Dn,Pn=A(()=>{Dn=`

	// step through multiple surface hits and accumulate color attenuation based on transmissive surfaces
	// returns true if a solid surface was hit
	bool attenuateHit(
		RenderState state,
		Ray ray, float rayDist,
		out vec3 color
	) {

		int traversals = state.traversals;
		int transmissiveTraversals = state.transmissiveTraversals;
		bool isShadowRay = state.isShadowRay;
		Material fogMaterial = state.fogMaterial;

		vec3 startPoint = ray.origin;

		// hit results
		SurfaceHit surfaceHit;

		color = vec3( 1.0 );

		// TODO: we should be using sobol sampling here instead of rand but the sobol bounce and path indices need to be incremented
		// and then reset.
		for ( int i = 0; i < traversals; i ++ ) {

			int hitType = traceScene( ray, fogMaterial, surfaceHit );

			if ( hitType == FOG_HIT ) {

				return true;

			} else if ( hitType == SURFACE_HIT ) {

				float totalDist = distance( startPoint, ray.origin + ray.direction * surfaceHit.dist );
				if ( totalDist > rayDist ) {

					return false;

				}

				// TODO: attenuate the contribution based on the PDF of the resulting ray including refraction values
				// Should be able to work using the material BSDF functions which will take into account specularity, etc.
				// TODO: should we account for emissive surfaces here?

				uint materialIndex = uTexelFetch1D( materialIndexAttribute, surfaceHit.faceIndices.x ).r;
				Material material = readMaterialInfo( materials, materialIndex );

				// adjust the ray to the new surface
				bool isEntering = surfaceHit.side == 1.0;
				ray.origin = stepRayOrigin( ray.origin, ray.direction, - surfaceHit.faceNormal, surfaceHit.dist );

				#if FEATURE_FOG

				if ( material.fogVolume ) {

					fogMaterial = material;
					fogMaterial.fogVolume = surfaceHit.side == 1.0;
					i -= sign( transmissiveTraversals );
					transmissiveTraversals --;
					continue;

				}

				#endif

				if ( ! material.castShadow && isShadowRay ) {

					continue;

				}

				vec2 uv = textureSampleBarycoord( attributesArray, ATTR_UV, surfaceHit.barycoord, surfaceHit.faceIndices.xyz ).xy;
				vec4 vertexColor = textureSampleBarycoord( attributesArray, ATTR_COLOR, surfaceHit.barycoord, surfaceHit.faceIndices.xyz );

				// albedo
				vec4 albedo = vec4( material.color, material.opacity );
				if ( material.map != - 1 ) {

					vec3 uvPrime = material.mapTransform * vec3( uv, 1 );
					albedo *= texture2D( textures, vec3( uvPrime.xy, material.map ) );

				}

				if ( material.vertexColors ) {

					albedo *= vertexColor;

				}

				// alphaMap
				if ( material.alphaMap != - 1 ) {

					albedo.a *= texture2D( textures, vec3( uv, material.alphaMap ) ).x;

				}

				// transmission
				float transmission = material.transmission;
				if ( material.transmissionMap != - 1 ) {

					vec3 uvPrime = material.transmissionMapTransform * vec3( uv, 1 );
					transmission *= texture2D( textures, vec3( uvPrime.xy, material.transmissionMap ) ).r;

				}

				// metalness
				float metalness = material.metalness;
				if ( material.metalnessMap != - 1 ) {

					vec3 uvPrime = material.metalnessMapTransform * vec3( uv, 1 );
					metalness *= texture2D( textures, vec3( uvPrime.xy, material.metalnessMap ) ).b;

				}

				float alphaTest = material.alphaTest;
				bool useAlphaTest = alphaTest != 0.0;
				float transmissionFactor = ( 1.0 - metalness ) * transmission;
				if (
					transmissionFactor < rand() && ! (
						// material sidedness
						material.side != 0.0 && surfaceHit.side == material.side

						// alpha test
						|| useAlphaTest && albedo.a < alphaTest

						// opacity
						|| material.transparent && ! useAlphaTest && albedo.a < rand()
					)
				) {

					return true;

				}

				if ( surfaceHit.side == 1.0 && isEntering ) {

					// only attenuate by surface color on the way in
					color *= mix( vec3( 1.0 ), albedo.rgb, transmissionFactor );

				} else if ( surfaceHit.side == - 1.0 ) {

					// attenuate by medium once we hit the opposite side of the model
					color *= transmissionAttenuation( surfaceHit.dist, material.attenuationColor, material.attenuationDistance );

				}

				bool isTransmissiveRay = dot( ray.direction, surfaceHit.faceNormal * surfaceHit.side ) < 0.0;
				if ( ( isTransmissiveRay || isEntering ) && transmissiveTraversals > 0 ) {

					i -= sign( transmissiveTraversals );
					transmissiveTraversals --;

				}

			} else {

				return false;

			}

		}

		return true;

	}

`});var Ln,Gn=A(()=>{Ln=`

	#define NO_HIT 0
	#define SURFACE_HIT 1
	#define LIGHT_HIT 2
	#define FOG_HIT 3

	// Passing the global variable 'lights' into this function caused shader program errors.
	// So global variables like 'lights' and 'bvh' were moved out of the function parameters.
	// For more information, refer to: https://github.com/gkjohnson/three-gpu-pathtracer/pull/457
	int traceScene(

		Ray ray, Material fogMaterial, inout SurfaceHit surfaceHit

	) {

		int result = NO_HIT;
		bool hit = bvhIntersectFirstHit( bvh, ray.origin, ray.direction, surfaceHit.faceIndices, surfaceHit.faceNormal, surfaceHit.barycoord, surfaceHit.side, surfaceHit.dist );

		#if FEATURE_FOG

		if ( fogMaterial.fogVolume ) {

			// offset the distance so we don't run into issues with particles on the same surface
			// as other objects
			float particleDist = intersectFogVolume( fogMaterial, sobol( 1 ) );
			if ( particleDist + RAY_OFFSET < surfaceHit.dist ) {

				surfaceHit.side = 1.0;
				surfaceHit.faceNormal = normalize( - ray.direction );
				surfaceHit.dist = particleDist;
				return FOG_HIT;

			}

		}

		#endif

		if ( hit ) {

			result = SURFACE_HIT;

		}

		return result;

	}

`});var Nn,On=A(()=>{Nn=`

	#define SKIP_SURFACE 0
	#define HIT_SURFACE 1
	int getSurfaceRecord(
		Material material, SurfaceHit surfaceHit, sampler2DArray attributesArray,
		float accumulatedRoughness,
		inout SurfaceRecord surf
	) {

		if ( material.fogVolume ) {

			vec3 normal = vec3( 0, 0, 1 );

			SurfaceRecord fogSurface;
			fogSurface.volumeParticle = true;
			fogSurface.color = material.color;
			fogSurface.emission = material.emissiveIntensity * material.emissive;
			fogSurface.normal = normal;
			fogSurface.faceNormal = normal;
			fogSurface.clearcoatNormal = normal;

			surf = fogSurface;
			return HIT_SURFACE;

		}

		// uv coord for textures
		vec2 uv = textureSampleBarycoord( attributesArray, ATTR_UV, surfaceHit.barycoord, surfaceHit.faceIndices.xyz ).xy;
		vec4 vertexColor = textureSampleBarycoord( attributesArray, ATTR_COLOR, surfaceHit.barycoord, surfaceHit.faceIndices.xyz );

		// albedo
		vec4 albedo = vec4( material.color, material.opacity );
		if ( material.map != - 1 ) {

			vec3 uvPrime = material.mapTransform * vec3( uv, 1 );
			albedo *= texture2D( textures, vec3( uvPrime.xy, material.map ) );
		}

		if ( material.vertexColors ) {

			albedo *= vertexColor;

		}

		// alphaMap
		if ( material.alphaMap != - 1 ) {

			albedo.a *= texture2D( textures, vec3( uv, material.alphaMap ) ).x;

		}

		// possibly skip this sample if it's transparent, alpha test is enabled, or we hit the wrong material side
		// and it's single sided.
		// - alpha test is disabled when it === 0
		// - the material sidedness test is complicated because we want light to pass through the back side but still
		// be able to see the front side. This boolean checks if the side we hit is the front side on the first ray
		// and we're rendering the other then we skip it. Do the opposite on subsequent bounces to get incoming light.
		float alphaTest = material.alphaTest;
		bool useAlphaTest = alphaTest != 0.0;
		if (
			// material sidedness
			material.side != 0.0 && surfaceHit.side != material.side

			// alpha test
			|| useAlphaTest && albedo.a < alphaTest

			// opacity
			|| material.transparent && ! useAlphaTest && albedo.a < sobol( 3 )
		) {

			return SKIP_SURFACE;

		}

		// fetch the interpolated smooth normal
		vec3 normal = normalize( textureSampleBarycoord(
			attributesArray,
			ATTR_NORMAL,
			surfaceHit.barycoord,
			surfaceHit.faceIndices.xyz
		).xyz );

		// roughness
		float roughness = material.roughness;
		if ( material.roughnessMap != - 1 ) {

			vec3 uvPrime = material.roughnessMapTransform * vec3( uv, 1 );
			roughness *= texture2D( textures, vec3( uvPrime.xy, material.roughnessMap ) ).g;

		}

		// metalness
		float metalness = material.metalness;
		if ( material.metalnessMap != - 1 ) {

			vec3 uvPrime = material.metalnessMapTransform * vec3( uv, 1 );
			metalness *= texture2D( textures, vec3( uvPrime.xy, material.metalnessMap ) ).b;

		}

		// emission
		vec3 emission = material.emissiveIntensity * material.emissive;
		if ( material.emissiveMap != - 1 ) {

			vec3 uvPrime = material.emissiveMapTransform * vec3( uv, 1 );
			emission *= texture2D( textures, vec3( uvPrime.xy, material.emissiveMap ) ).xyz;

		}

		// transmission
		float transmission = material.transmission;
		if ( material.transmissionMap != - 1 ) {

			vec3 uvPrime = material.transmissionMapTransform * vec3( uv, 1 );
			transmission *= texture2D( textures, vec3( uvPrime.xy, material.transmissionMap ) ).r;

		}

		// normal
		if ( material.flatShading ) {

			// if we're rendering a flat shaded object then use the face normals - the face normal
			// is provided based on the side the ray hits the mesh so flip it to align with the
			// interpolated vertex normals.
			normal = surfaceHit.faceNormal * surfaceHit.side;

		}

		vec3 baseNormal = normal;
		if ( material.normalMap != - 1 ) {

			vec4 tangentSample = textureSampleBarycoord(
				attributesArray,
				ATTR_TANGENT,
				surfaceHit.barycoord,
				surfaceHit.faceIndices.xyz
			);

			// some provided tangents can be malformed (0, 0, 0) causing the normal to be degenerate
			// resulting in NaNs and slow path tracing.
			if ( length( tangentSample.xyz ) > 0.0 ) {

				vec3 tangent = normalize( tangentSample.xyz );
				vec3 bitangent = normalize( cross( normal, tangent ) * tangentSample.w );
				mat3 vTBN = mat3( tangent, bitangent, normal );

				vec3 uvPrime = material.normalMapTransform * vec3( uv, 1 );
				vec3 texNormal = texture2D( textures, vec3( uvPrime.xy, material.normalMap ) ).xyz * 2.0 - 1.0;
				texNormal.xy *= material.normalScale;
				normal = vTBN * texNormal;

			}

		}

		normal *= surfaceHit.side;

		// clearcoat
		float clearcoat = material.clearcoat;
		if ( material.clearcoatMap != - 1 ) {

			vec3 uvPrime = material.clearcoatMapTransform * vec3( uv, 1 );
			clearcoat *= texture2D( textures, vec3( uvPrime.xy, material.clearcoatMap ) ).r;

		}

		// clearcoatRoughness
		float clearcoatRoughness = material.clearcoatRoughness;
		if ( material.clearcoatRoughnessMap != - 1 ) {

			vec3 uvPrime = material.clearcoatRoughnessMapTransform * vec3( uv, 1 );
			clearcoatRoughness *= texture2D( textures, vec3( uvPrime.xy, material.clearcoatRoughnessMap ) ).g;

		}

		// clearcoatNormal
		vec3 clearcoatNormal = baseNormal;
		if ( material.clearcoatNormalMap != - 1 ) {

			vec4 tangentSample = textureSampleBarycoord(
				attributesArray,
				ATTR_TANGENT,
				surfaceHit.barycoord,
				surfaceHit.faceIndices.xyz
			);

			// some provided tangents can be malformed (0, 0, 0) causing the normal to be degenerate
			// resulting in NaNs and slow path tracing.
			if ( length( tangentSample.xyz ) > 0.0 ) {

				vec3 tangent = normalize( tangentSample.xyz );
				vec3 bitangent = normalize( cross( clearcoatNormal, tangent ) * tangentSample.w );
				mat3 vTBN = mat3( tangent, bitangent, clearcoatNormal );

				vec3 uvPrime = material.clearcoatNormalMapTransform * vec3( uv, 1 );
				vec3 texNormal = texture2D( textures, vec3( uvPrime.xy, material.clearcoatNormalMap ) ).xyz * 2.0 - 1.0;
				texNormal.xy *= material.clearcoatNormalScale;
				clearcoatNormal = vTBN * texNormal;

			}

		}

		clearcoatNormal *= surfaceHit.side;

		// sheenColor
		vec3 sheenColor = material.sheenColor;
		if ( material.sheenColorMap != - 1 ) {

			vec3 uvPrime = material.sheenColorMapTransform * vec3( uv, 1 );
			sheenColor *= texture2D( textures, vec3( uvPrime.xy, material.sheenColorMap ) ).rgb;

		}

		// sheenRoughness
		float sheenRoughness = material.sheenRoughness;
		if ( material.sheenRoughnessMap != - 1 ) {

			vec3 uvPrime = material.sheenRoughnessMapTransform * vec3( uv, 1 );
			sheenRoughness *= texture2D( textures, vec3( uvPrime.xy, material.sheenRoughnessMap ) ).a;

		}

		// iridescence
		float iridescence = material.iridescence;
		if ( material.iridescenceMap != - 1 ) {

			vec3 uvPrime = material.iridescenceMapTransform * vec3( uv, 1 );
			iridescence *= texture2D( textures, vec3( uvPrime.xy, material.iridescenceMap ) ).r;

		}

		// iridescence thickness
		float iridescenceThickness = material.iridescenceThicknessMaximum;
		if ( material.iridescenceThicknessMap != - 1 ) {

			vec3 uvPrime = material.iridescenceThicknessMapTransform * vec3( uv, 1 );
			float iridescenceThicknessSampled = texture2D( textures, vec3( uvPrime.xy, material.iridescenceThicknessMap ) ).g;
			iridescenceThickness = mix( material.iridescenceThicknessMinimum, material.iridescenceThicknessMaximum, iridescenceThicknessSampled );

		}

		iridescence = iridescenceThickness == 0.0 ? 0.0 : iridescence;

		// specular color
		vec3 specularColor = material.specularColor;
		if ( material.specularColorMap != - 1 ) {

			vec3 uvPrime = material.specularColorMapTransform * vec3( uv, 1 );
			specularColor *= texture2D( textures, vec3( uvPrime.xy, material.specularColorMap ) ).rgb;

		}

		// specular intensity
		float specularIntensity = material.specularIntensity;
		if ( material.specularIntensityMap != - 1 ) {

			vec3 uvPrime = material.specularIntensityMapTransform * vec3( uv, 1 );
			specularIntensity *= texture2D( textures, vec3( uvPrime.xy, material.specularIntensityMap ) ).a;

		}

		surf.volumeParticle = false;

		surf.faceNormal = surfaceHit.faceNormal;
		surf.normal = normal;

		surf.metalness = metalness;
		surf.color = albedo.rgb;
		surf.emission = emission;

		surf.ior = material.ior;
		surf.transmission = transmission;
		surf.thinFilm = material.thinFilm;
		surf.attenuationColor = material.attenuationColor;
		surf.attenuationDistance = material.attenuationDistance;

		surf.clearcoatNormal = clearcoatNormal;
		surf.clearcoat = clearcoat;

		surf.sheen = material.sheen;
		surf.sheenColor = sheenColor;

		surf.iridescence = iridescence;
		surf.iridescenceIor = material.iridescenceIor;
		surf.iridescenceThickness = iridescenceThickness;

		surf.specularColor = specularColor;
		surf.specularIntensity = specularIntensity;

		// apply perceptual roughness factor from gltf. sheen perceptual roughness is
		// applied by its brdf function
		// https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#microfacet-surfaces
		surf.roughness = roughness * roughness;
		surf.clearcoatRoughness = clearcoatRoughness * clearcoatRoughness;
		surf.sheenRoughness = sheenRoughness;

		// frontFace is used to determine transmissive properties and PDF. If no transmission is used
		// then we can just always assume this is a front face.
		surf.frontFace = surfaceHit.side == 1.0 || transmission == 0.0;
		surf.eta = material.thinFilm || surf.frontFace ? 1.0 / material.ior : material.ior;
		surf.f0 = iorRatioToF0( surf.eta );

		// Compute the filtered roughness value to use during specular reflection computations.
		// The accumulated roughness value is scaled by a user setting and a "magic value" of 5.0.
		// If we're exiting something transmissive then scale the factor down significantly so we can retain
		// sharp internal reflections
		surf.filteredRoughness = applyFilteredGlossy( surf.roughness, accumulatedRoughness );
		surf.filteredClearcoatRoughness = applyFilteredGlossy( surf.clearcoatRoughness, accumulatedRoughness );

		// get the normal frames
		surf.normalBasis = getBasisFromNormal( surf.normal );
		surf.normalInvBasis = inverse( surf.normalBasis );

		surf.clearcoatBasis = getBasisFromNormal( surf.clearcoatNormal );
		surf.clearcoatInvBasis = inverse( surf.clearcoatBasis );

		return HIT_SURFACE;

	}
`});var zn,Un=A(()=>{zn=`

	vec3 directLightContribution( vec3 worldWo, SurfaceRecord surf, RenderState state, vec3 rayOrigin ) {

		vec3 result = vec3( 0.0 );

		// uniformly pick a light or environment map
		if( lightsDenom != 0.0 && sobol( 5 ) < float( lights.count ) / lightsDenom ) {

			// sample a light or environment
			LightRecord lightRec = randomLightSample( lights.tex, iesProfiles, lights.count, rayOrigin, sobol3( 6 ) );

			bool isSampleBelowSurface = ! surf.volumeParticle && dot( surf.faceNormal, lightRec.direction ) < 0.0;
			if ( isSampleBelowSurface ) {

				lightRec.pdf = 0.0;

			}

			// check if a ray could even reach the light area
			Ray lightRay;
			lightRay.origin = rayOrigin;
			lightRay.direction = lightRec.direction;
			vec3 attenuatedColor;
			if (
				lightRec.pdf > 0.0 &&
				isDirectionValid( lightRec.direction, surf.normal, surf.faceNormal ) &&
				! attenuateHit( state, lightRay, lightRec.dist, attenuatedColor )
			) {

				// get the material pdf
				vec3 sampleColor;
				float lightMaterialPdf = bsdfResult( worldWo, lightRec.direction, surf, sampleColor );
				bool isValidSampleColor = all( greaterThanEqual( sampleColor, vec3( 0.0 ) ) );
				if ( lightMaterialPdf > 0.0 && isValidSampleColor ) {

					// weight the direct light contribution
					float lightPdf = lightRec.pdf / lightsDenom;
					float misWeight = lightRec.type == SPOT_LIGHT_TYPE || lightRec.type == DIR_LIGHT_TYPE || lightRec.type == POINT_LIGHT_TYPE ? 1.0 : misHeuristic( lightPdf, lightMaterialPdf );
					result = attenuatedColor * lightRec.emission * state.throughputColor * sampleColor * misWeight / lightPdf;

				}

			}

		} else {

			// find a sample in the environment map to include in the contribution
			vec3 envColor, envDirection;
			float envPdf = sampleEquirectProbability( sobol2( 7 ), envColor, envDirection );
			envDirection = invEnvRotation3x3 * envDirection;

			// this env sampling is not set up for transmissive sampling and yields overly bright
			// results so we ignore the sample in this case.
			// TODO: this should be improved but how? The env samples could traverse a few layers?
			bool isSampleBelowSurface = ! surf.volumeParticle && dot( surf.faceNormal, envDirection ) < 0.0;
			if ( isSampleBelowSurface ) {

				envPdf = 0.0;

			}

			// check if a ray could even reach the surface
			Ray envRay;
			envRay.origin = rayOrigin;
			envRay.direction = envDirection;
			vec3 attenuatedColor;
			if (
				envPdf > 0.0 &&
				isDirectionValid( envDirection, surf.normal, surf.faceNormal ) &&
				! attenuateHit( state, envRay, INFINITY, attenuatedColor )
			) {

				// get the material pdf
				vec3 sampleColor;
				float envMaterialPdf = bsdfResult( worldWo, envDirection, surf, sampleColor );
				bool isValidSampleColor = all( greaterThanEqual( sampleColor, vec3( 0.0 ) ) );
				if ( envMaterialPdf > 0.0 && isValidSampleColor ) {

					// weight the direct light contribution
					envPdf /= lightsDenom;
					float misWeight = misHeuristic( envPdf, envMaterialPdf );
					result = attenuatedColor * environmentIntensity * envColor * state.throughputColor * sampleColor * misWeight / envPdf;

				}

			}

		}

		// Function changed to have a single return statement to potentially help with crashes on Mac OS.
		// See issue #470
		return result;

	}

`});var Fr,kn=A(()=>{B();Lt();gr();_s();Cs();Is();Ps();Ns();ks();Ws();Xs();$s();Ks();Zs();en();cn();fn();mn();dn();xn();bn();yn();Rn();wn();_n();Cn();Gr();In();Bn();Pn();Gn();On();Un();Fr=class extends Re{onBeforeRender(){this.setDefine("FEATURE_DOF",this.physicalCamera.bokehSize===0?0:1),this.setDefine("FEATURE_BACKGROUND_MAP",this.backgroundMap?1:0),this.setDefine("FEATURE_FOG",this.materials.features.isUsed("FOG")?1:0)}constructor(e){super({transparent:!0,depthWrite:!1,defines:{FEATURE_MIS:1,FEATURE_RUSSIAN_ROULETTE:1,FEATURE_DOF:1,FEATURE_BACKGROUND_MAP:0,FEATURE_FOG:1,FEATURE_SOBOL:0,CAMERA_TYPE:0,DEBUG_MODE:0,ATTR_NORMAL:0,ATTR_TANGENT:1,ATTR_UV:2,ATTR_COLOR:3},uniforms:{resolution:{value:new Q},bounces:{value:10},transmissiveBounces:{value:10},physicalCamera:{value:new br},bvh:{value:new pr},attributesArray:{value:new wr},materialIndexAttribute:{value:new st},materials:{value:new Mr},textures:{value:new Cr().texture},lights:{value:new yr},iesProfiles:{value:new Rr().texture},cameraWorldMatrix:{value:new z},invProjectionMatrix:{value:new z},backgroundBlur:{value:0},environmentIntensity:{value:1},environmentRotation:{value:new z},envMapInfo:{value:new vr},backgroundMap:{value:null},seed:{value:0},opacity:{value:1},filterGlossyFactor:{value:0},backgroundAlpha:{value:1},sobolTexture:{value:null}},vertexShader:`

				varying vec2 vUv;
				void main() {

					vec4 mvPosition = vec4( position, 1.0 );
					mvPosition = modelViewMatrix * mvPosition;
					gl_Position = projectionMatrix * mvPosition;

					vUv = uv;

				}

			`,fragmentShader:`
				#define RAY_OFFSET 1e-4
				#define INFINITY 1e20

				precision highp isampler2D;
				precision highp usampler2D;
				precision highp sampler2DArray;
				vec4 envMapTexelToLinear( vec4 a ) { return a; }
				#include <common>

				// bvh intersection
				${Ce.common_functions}
				${Ce.bvh_struct_definitions}
				${Ce.bvh_ray_functions}

				// uniform structs
				${qs}
				${js}
				${Ys}
				${Qs}

				// random
				${Mn}
				#if FEATURE_SOBOL

					${zt}
					${ko}

				#else

					// Using the sobol functions seems to break the the compiler on MacOS
					// - specifically the "sobolReverseBits" function.
					uint sobolPixelIndex = 0u;
					uint sobolPathIndex = 0u;
					uint sobolBounceIndex = 0u;
					float sobol( int v ) { return rand(); }
					vec2 sobol2( int v ) { return rand2(); }
					vec3 sobol3( int v ) { return rand3(); }
					vec4 sobol4( int v ) { return rand4(); }

				#endif

				// common
				${An}
				${Sn}
				${En}
				${vn}
				${Tn}

				// environment
				uniform EquirectHdrInfo envMapInfo;
				uniform mat4 environmentRotation;
				uniform float environmentIntensity;

				// lighting
				uniform sampler2DArray iesProfiles;
				uniform LightsInfo lights;

				// background
				uniform float backgroundBlur;
				uniform float backgroundAlpha;
				#if FEATURE_BACKGROUND_MAP

				uniform sampler2D backgroundMap;

				#endif

				// camera
				uniform mat4 cameraWorldMatrix;
				uniform mat4 invProjectionMatrix;
				#if FEATURE_DOF

				uniform PhysicalCamera physicalCamera;

				#endif

				// geometry
				uniform sampler2DArray attributesArray;
				uniform usampler2D materialIndexAttribute;
				uniform sampler2D materials;
				uniform sampler2DArray textures;
				uniform BVH bvh;

				// path tracer
				uniform int bounces;
				uniform int transmissiveBounces;
				uniform float filterGlossyFactor;
				uniform int seed;

				// image
				uniform vec2 resolution;
				uniform float opacity;

				varying vec2 vUv;

				// globals
				mat3 envRotation3x3;
				mat3 invEnvRotation3x3;
				float lightsDenom;

				// sampling
				${Js}
				${gn}
				${ln}
				${pn}
				${hn}
				${un}

				float applyFilteredGlossy( float roughness, float accumulatedRoughness ) {

					return clamp(
						max(
							roughness,
							accumulatedRoughness * filterGlossyFactor * 5.0 ),
						0.0,
						1.0
					);

				}

				vec3 sampleBackground( vec3 direction, vec2 uv ) {

					vec3 sampleDir = normalize( direction + sampleHemisphere( direction, uv ) * 0.5 * backgroundBlur );

					#if FEATURE_BACKGROUND_MAP

					return sampleEquirectColor( backgroundMap, sampleDir );

					#else

					return environmentIntensity * sampleEquirectColor( envMapInfo.map, sampleDir );

					#endif

				}

				${Fn}
				${Hn}
				${Ln}
				${Dn}
				${zn}
				${Nn}

				void main() {

					// init
					rng_initialize( gl_FragCoord.xy, seed );
					sobolPixelIndex = ( uint( gl_FragCoord.x ) << 16 ) | uint( gl_FragCoord.y );
					sobolPathIndex = uint( seed );

					// get camera ray
					Ray ray = getCameraRay();

					// inverse environment rotation
					envRotation3x3 = mat3( environmentRotation );
					invEnvRotation3x3 = inverse( envRotation3x3 );
					lightsDenom = environmentIntensity == 0.0 && lights.count != 0u ? float( lights.count ) : float( lights.count + 1u );

					// final color
					gl_FragColor = vec4( 0, 0, 0, 1 );

					// surface results
					SurfaceHit surfaceHit;
					ScatterRecord scatterRec;

					// path tracing state
					RenderState state = initRenderState();
					state.transmissiveTraversals = transmissiveBounces;
					#if FEATURE_FOG

					state.fogMaterial.fogVolume = bvhIntersectFogVolumeHit(
						ray.origin, - ray.direction,
						materialIndexAttribute, materials,
						state.fogMaterial
					);

					#endif

					for ( int i = 0; i < bounces; i ++ ) {

						sobolBounceIndex ++;

						state.depth ++;
						state.traversals = bounces - i;
						state.firstRay = i == 0 && state.transmissiveTraversals == transmissiveBounces;

						int hitType = traceScene( ray, state.fogMaterial, surfaceHit );

						// check if we intersect any lights and accumulate the light contribution
						// TODO: we can add support for light surface rendering in the else condition if we
						// add the ability to toggle visibility of the the light
						if ( ! state.firstRay && ! state.transmissiveRay ) {

							LightRecord lightRec;
							float lightDist = hitType == NO_HIT ? INFINITY : surfaceHit.dist;
							for ( uint i = 0u; i < lights.count; i ++ ) {

								if (
									intersectLightAtIndex( lights.tex, ray.origin, ray.direction, i, lightRec ) &&
									lightRec.dist < lightDist
								) {

									#if FEATURE_MIS

									// weight the contribution
									// NOTE: Only area lights are supported for forward sampling and can be hit
									float misWeight = misHeuristic( scatterRec.pdf, lightRec.pdf / lightsDenom );
									gl_FragColor.rgb += lightRec.emission * state.throughputColor * misWeight;

									#else

									gl_FragColor.rgb += lightRec.emission * state.throughputColor;

									#endif

								}

							}

						}

						if ( hitType == NO_HIT ) {

							if ( state.firstRay || state.transmissiveRay ) {

								gl_FragColor.rgb += sampleBackground( envRotation3x3 * ray.direction, sobol2( 2 ) ) * state.throughputColor;
								gl_FragColor.a = backgroundAlpha;

							} else {

								#if FEATURE_MIS

								// get the PDF of the hit envmap point
								vec3 envColor;
								float envPdf = sampleEquirect( envRotation3x3 * ray.direction, envColor );
								envPdf /= lightsDenom;

								// and weight the contribution
								float misWeight = misHeuristic( scatterRec.pdf, envPdf );
								gl_FragColor.rgb += environmentIntensity * envColor * state.throughputColor * misWeight;

								#else

								gl_FragColor.rgb +=
									environmentIntensity *
									sampleEquirectColor( envMapInfo.map, envRotation3x3 * ray.direction ) *
									state.throughputColor;

								#endif

							}
							break;

						}

						uint materialIndex = uTexelFetch1D( materialIndexAttribute, surfaceHit.faceIndices.x ).r;
						Material material = readMaterialInfo( materials, materialIndex );

						#if FEATURE_FOG

						if ( hitType == FOG_HIT ) {

							material = state.fogMaterial;
							state.accumulatedRoughness += 0.2;

						} else if ( material.fogVolume ) {

							state.fogMaterial = material;
							state.fogMaterial.fogVolume = surfaceHit.side == 1.0;

							ray.origin = stepRayOrigin( ray.origin, ray.direction, - surfaceHit.faceNormal, surfaceHit.dist );

							i -= sign( state.transmissiveTraversals );
							state.transmissiveTraversals -= sign( state.transmissiveTraversals );
							continue;

						}

						#endif

						// early out if this is a matte material
						if ( material.matte && state.firstRay ) {

							gl_FragColor = vec4( 0.0 );
							break;

						}

						// if we've determined that this is a shadow ray and we've hit an item with no shadow casting
						// then skip it
						if ( ! material.castShadow && state.isShadowRay ) {

							ray.origin = stepRayOrigin( ray.origin, ray.direction, - surfaceHit.faceNormal, surfaceHit.dist );
							continue;

						}

						SurfaceRecord surf;
						if (
							getSurfaceRecord(
								material, surfaceHit, attributesArray, state.accumulatedRoughness,
								surf
							) == SKIP_SURFACE
						) {

							// only allow a limited number of transparency discards otherwise we could
							// crash the context with too long a loop.
							i -= sign( state.transmissiveTraversals );
							state.transmissiveTraversals -= sign( state.transmissiveTraversals );

							ray.origin = stepRayOrigin( ray.origin, ray.direction, - surfaceHit.faceNormal, surfaceHit.dist );
							continue;

						}

						scatterRec = bsdfSample( - ray.direction, surf );
						state.isShadowRay = scatterRec.specularPdf < sobol( 4 );

						bool isBelowSurface = ! surf.volumeParticle && dot( scatterRec.direction, surf.faceNormal ) < 0.0;
						vec3 hitPoint = stepRayOrigin( ray.origin, ray.direction, isBelowSurface ? - surf.faceNormal : surf.faceNormal, surfaceHit.dist );

						// next event estimation
						#if FEATURE_MIS

						gl_FragColor.rgb += directLightContribution( - ray.direction, surf, state, hitPoint );

						#endif

						// accumulate a roughness value to offset diffuse, specular, diffuse rays that have high contribution
						// to a single pixel resulting in fireflies
						// TODO: handle transmissive surfaces
						if ( ! surf.volumeParticle && ! isBelowSurface ) {

							// determine if this is a rough normal or not by checking how far off straight up it is
							vec3 halfVector = normalize( - ray.direction + scatterRec.direction );
							state.accumulatedRoughness += max(
								sin( acosApprox( dot( halfVector, surf.normal ) ) ),
								sin( acosApprox( dot( halfVector, surf.clearcoatNormal ) ) )
							);

							state.transmissiveRay = false;

						}

						// accumulate emissive color
						gl_FragColor.rgb += ( surf.emission * state.throughputColor );

						// skip the sample if our PDF or ray is impossible
						if ( scatterRec.pdf <= 0.0 || ! isDirectionValid( scatterRec.direction, surf.normal, surf.faceNormal ) ) {

							break;

						}

						// if we're bouncing around the inside a transmissive material then decrement
						// perform this separate from a bounce
						bool isTransmissiveRay = ! surf.volumeParticle && dot( scatterRec.direction, surf.faceNormal * surfaceHit.side ) < 0.0;
						if ( ( isTransmissiveRay || isBelowSurface ) && state.transmissiveTraversals > 0 ) {

							state.transmissiveTraversals --;
							i --;

						}

						//

						// handle throughput color transformation
						// attenuate the throughput color by the medium color
						if ( ! surf.frontFace ) {

							state.throughputColor *= transmissionAttenuation( surfaceHit.dist, surf.attenuationColor, surf.attenuationDistance );

						}

						#if FEATURE_RUSSIAN_ROULETTE

						// russian roulette path termination
						// https://www.arnoldrenderer.com/research/physically_based_shader_design_in_arnold.pdf
						uint minBounces = 3u;
						float depthProb = float( state.depth < minBounces );

						float rrProb = luminance( state.throughputColor * scatterRec.color / scatterRec.pdf );
						rrProb /= luminance( state.throughputColor );
						rrProb = sqrt( rrProb );
						rrProb = max( rrProb, depthProb );
						rrProb = min( rrProb, 1.0 );
						if ( sobol( 8 ) > rrProb ) {

							break;

						}

						// perform sample clamping here to avoid bright pixels
						state.throughputColor *= min( 1.0 / rrProb, 20.0 );

						#endif

						// adjust the throughput and discard and exit if we find discard the sample if there are any NaNs
						state.throughputColor *= scatterRec.color / scatterRec.pdf;
						if ( any( isnan( state.throughputColor ) ) || any( isinf( state.throughputColor ) ) ) {

							break;

						}

						//

						// prepare for next ray
						ray.direction = scatterRec.direction;
						ray.origin = hitPoint;

					}

					gl_FragColor.a *= opacity;

					#if DEBUG_MODE == 1

					// output the number of rays checked in the path and number of
					// transmissive rays encountered.
					gl_FragColor.rgb = vec3(
						float( state.depth ),
						transmissiveBounces - state.transmissiveTraversals,
						0.0
					);
					gl_FragColor.a = 1.0;

					#endif

				}

			`}),this.setValues(e)}}});var Ne,Vn,Ir,Hr,Br,Wn=A(()=>{B();Ne=new Q,Vn=new Q,Ir=new No,Hr=new fe,Br=class extends K{constructor(e=512,t=512){super(new Uint16Array(e*t*4),e,t,O,ee,So,me,ue,X,X),this.generationCallback=null}update(){this.dispose(),this.needsUpdate=!0;let{data:e,width:t,height:r}=this.image;for(let s=0;s<t;s++)for(let l=0;l<r;l++){Vn.set(t,r),Ne.set(s/t,l/r),Ne.x-=.5,Ne.y=1-Ne.y,Ir.theta=Ne.x*2*Math.PI,Ir.phi=Ne.y*Math.PI,Ir.radius=1,this.generationCallback(Ir,Ne,Vn,Hr);let i=4*(l*t+s);e[i+0]=se.toHalfFloat(Hr.r),e[i+1]=se.toHalfFloat(Hr.g),e[i+2]=se.toHalfFloat(Hr.b),e[i+3]=se.toHalfFloat(1)}}copy(e){return super.copy(e),this.generationCallback=e.generationCallback,this}}});var qn,Dr,Xn=A(()=>{B();Wn();qn=new C,Dr=class extends Br{constructor(e=512){super(e,e),this.topColor=new fe().set(16777215),this.bottomColor=new fe().set(0),this.exponent=2,this.generationCallback=(t,r,s,l)=>{qn.setFromSpherical(t);let n=qn.y*.5+.5;l.lerpColors(this.bottomColor,this.topColor,n**this.exponent)}}copy(e){return super.copy(e),this.topColor.copy(e.topColor),this.bottomColor.copy(e.bottomColor),this}}});var ka=$n(()=>{qo();ws();kn();Xn();Ue();globalThis.THREE_PATHTRACER={PathTracingRenderer:kt,PathTracingSceneGenerator:xr,PhysicalPathTracingMaterial:Fr,GradientEquirectTexture:Dr,FullScreenQuad:ne,version:"three-gpu-pathtracer 0.0.17, three-mesh-bvh 0.7.0"}});ka();})();
