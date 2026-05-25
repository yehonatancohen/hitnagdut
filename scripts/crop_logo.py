import os
from PIL import Image

def main():
    img_path = r"C:\Users\User\.gemini\antigravity\brain\efbe92d5-bc75-4d3a-8d61-8bb0d520792d\media__1779731985723.png"
    img = Image.open(img_path).convert("RGBA")
    width, height = img.size
    
    # Detect the colored boundary
    boundary_y = int(height * 0.55)
    for y in range(height):
        r, g, b, a = img.getpixel((100, y))
        if r < 40 and g < 60 and b > 60:
            boundary_y = y
            break
            
    # Crop the upper section, but subtract 30 pixels to completely avoid the gray border line at the bottom of the panel!
    safe_boundary_y = boundary_y - 30
    print(f"Detected vertical boundary at y={boundary_y}. Using safe crop boundary at y={safe_boundary_y}")
    
    upper_img = img.crop((0, 0, width, safe_boundary_y))
    
    # Make white background transparent
    datas = upper_img.getdata()
    newData = []
    for item in datas:
        r, g, b, a = item
        # Background is warm off-white, threshold of 240 is perfect
        if r > 240 and g > 240 and b > 240:
            newData.append((255, 255, 255, 0)) # fully transparent
        else:
            newData.append((r, g, b, 255))
            
    upper_img.putdata(newData)
    
    # Autocrop the transparent boundaries
    bbox = upper_img.getbbox()
    if bbox:
        cropped_logo = upper_img.crop(bbox)
        padding = 15
        padded_width = cropped_logo.width + padding * 2
        padded_height = cropped_logo.height + padding * 2
        
        final_logo = Image.new("RGBA", (padded_width, padded_height), (255, 255, 255, 0))
        final_logo.paste(cropped_logo, (padding, padding))
        
        final_logo.save("public/logo.png", "PNG")
        print(f"Successfully processed public/logo.png: size={final_logo.size}")
    else:
        upper_img.save("public/logo.png", "PNG")
        print("Bbox not found. Saved full upper section as logo.png")

if __name__ == "__main__":
    main()
