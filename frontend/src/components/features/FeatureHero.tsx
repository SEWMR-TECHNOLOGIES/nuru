import { motion } from "framer-motion";

interface FeatureHeroProps {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  imagePosition?: "left" | "right";
}

const FeatureHero = ({
  title,
  description,
  imageSrc,
  imageAlt,
  imagePosition = "right"
}: FeatureHeroProps) => {
  const isImageLeft = imagePosition === "left";

  return (
    <section className="min-h-[80vh] flex items-center py-20">
      <div className="w-full max-w-7xl mx-auto px-6 lg:px-16">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Text Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={isImageLeft ? "lg:order-2" : "lg:order-1"}
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
              {title}
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg">
              {description}
            </p>
          </motion.div>

          {/* Image with Organic Blob Shape */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className={`relative ${isImageLeft ? "lg:order-1" : "lg:order-2"}`}
          >
            <div className="relative">
              {/* SVG Blob Shape with Image */}
              <svg
                viewBox="0 0 500 500"
                className="w-full h-auto max-w-[500px] mx-auto"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <clipPath id={`blob-clip-${isImageLeft ? 'left' : 'right'}`}>
                    <path d={
                      isImageLeft
                        ? "M420,320Q400,390,330,420Q260,450,180,420Q100,390,70,310Q40,230,80,150Q120,70,200,50Q280,30,350,70Q420,110,430,190Q440,270,420,320Z"
                        : "M420,310Q380,370,320,400Q260,430,190,410Q120,390,80,320Q40,250,70,170Q100,90,180,60Q260,30,340,60Q420,90,440,170Q460,250,420,310Z"
                    } />
                  </clipPath>
                  <linearGradient id={`blob-gradient-${isImageLeft ? 'left' : 'right'}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.1" />
                  </linearGradient>
                </defs>

                {/* Background blob */}
                <motion.path
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 1, delay: 0.3 }}
                  d={
                    isImageLeft
                      ? "M430,330Q410,400,340,430Q270,460,190,430Q110,400,80,320Q50,240,90,160Q130,80,210,60Q290,40,360,80Q430,120,440,200Q450,280,430,330Z"
                      : "M430,320Q390,380,330,410Q270,440,200,420Q130,400,90,330Q50,260,80,180Q110,100,190,70Q270,40,350,70Q430,100,450,180Q470,260,430,320Z"
                  }
                  fill={`url(#blob-gradient-${isImageLeft ? 'left' : 'right'})`}
                  transform="translate(-5, -5)"
                />

                {/* Image in blob shape */}
                <image
                  href={imageSrc}
                  x="0"
                  y="0"
                  width="500"
                  height="500"
                  preserveAspectRatio="xMidYMid slice"
                  clipPath={`url(#blob-clip-${isImageLeft ? 'left' : 'right'})`}
                />

                {/* Decorative dots */}
                <motion.g
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                >
                  {[...Array(12)].map((_, i) => (
                    <circle
                      key={i}
                      cx={isImageLeft ? 450 - (i % 4) * 15 : 50 + (i % 4) * 15}
                      cy={380 + Math.floor(i / 4) * 15}
                      r="3"
                      className="fill-foreground/20"
                    />
                  ))}
                </motion.g>
              </svg>

              {/* Floating accent shapes */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className={`absolute ${isImageLeft ? '-right-4 top-10' : '-left-4 top-10'} w-16 h-16`}
              >
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <circle cx="50" cy="50" r="45" className="fill-primary/20" />
                  <circle cx="50" cy="50" r="25" className="fill-accent/30" />
                </svg>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: isImageLeft ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.7 }}
                className={`absolute ${isImageLeft ? '-left-8 bottom-20' : '-right-8 bottom-20'} w-20 h-20`}
              >
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <path
                    d="M10,50 Q10,10 50,10 Q90,10 90,50 Q90,90 50,90 Q10,90 10,50 Z"
                    className="fill-foreground/10"
                  />
                </svg>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default FeatureHero;
