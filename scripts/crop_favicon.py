import os
from PIL import Image

def main():
    img_path = r"C:\Users\User\.gemini\antigravity\brain\efbe92d5-bc75-4d3a-8d61-8bb0d520792d\media__1779731985723.png"
    img = Image.open(img_path).convert("RGBA")
    width, height = img.size
    
    # Bottom right quadrant of the image
    # Let's crop from x=600 to width, y=385 to height
    bottom_right = img.crop((600, 385, width, height))
    
    # Make white background transparent
    datas = bottom_right.getdata()
    newData = []
    for item in datas:
        r, g, b, a = item
        if r > 240 and g > 240 and b > 240:
            newData.append((255, 255, 255, 0))
        else:
            newData.append((r, g, b, 255))
            
    bottom_right.putdata(newData)
    
    # Autocrop the transparent boundaries to get only the plant graphic
    bbox = bottom_right.getbbox()
    if bbox:
        cropped_favicon = bottom_right.crop(bbox)
        
        # Let's verify if the bounding box has the label "FAVICON SCALE (~32px)" or just the plant.
        # Actually, the plant is much taller and is centered. Let's make sure we only grab the plant graphic.
        # The label is text, which is also non-transparent. Let's write a smarter crop.
        # The plant graphic is centered on the left of the bottom right quadrant.
        # Let's find the plant by only looking at the left portion of the cropped image (avoiding the text "FAVICON SCALE (~32px)" which is on the right/top of that quadrant).
        # Wait, the label "FAVICON SCALE" is located at the top of the quadrant.
        # Let's just crop specifically around where the plant is.
        # In a 1024x682 image, the bottom right quadrant is 424x297.
        # The plant is in the middle of it. Let's print out where non-transparent pixels are in bottom_right.
        # Alternatively, we can just crop the plant from the upper logo! That is even easier and guarantees we get the plant graphic perfectly without any text artifacts!
        # Yes! The upper logo has the plant on the far left. The plant on the far left spans from x=100 to x=300 (roughly).
        # Let's crop the plant directly from our already cropped and transparentized `public/logo.png`!
        # The logo is `(1054, 345)`. The plant is on the left of `Parsely` text.
        # Let's write a python script to crop the plant graphic from the left side of `public/logo.png`!
        # This is incredibly elegant and robust because `public/logo.png` is already perfectly transparent and contains exactly the plant and the text!
        # Let's inspect where the non-transparent pixels are in `public/logo.png`.
        # The plant starts at x=0 (after padding) and extends to the right until there is a gap before the word "Parsely" starts.
        # Let's find the vertical gap (column of all transparent pixels) between the plant and the text "Parsely".
        # That column will separate the plant from the text!
        pass

    # Let's write the robust column-gap separator:
    logo = Image.open("public/logo.png").convert("RGBA")
    w, h = logo.size
    
    # For each column from left to right, check if it has any non-transparent pixel
    has_pixels = []
    for x in range(w):
        col_has_pixel = False
        for y in range(h):
            r, g, b, a = logo.getpixel((x, y))
            if a > 0:
                col_has_pixel = True
                break
        has_pixels.append(col_has_pixel)
        
    # We want to find the first "gap" of transparent columns after the plant.
    # The plant starts at some x (first True in has_pixels).
    # Let's find the first True:
    first_true = has_pixels.index(True)
    
    # Now find the next sequence of Falses (transparent columns) that represents the gap before the text
    # A gap should be at least e.g. 10 columns wide to avoid small gaps inside the plant itself.
    gap_x = w
    consecutive_falses = 0
    for x in range(first_true, w):
        if not has_pixels[x]:
            consecutive_falses += 1
            if consecutive_falses >= 15: # 15 transparent columns
                gap_x = x - consecutive_falses + 5
                break
        else:
            consecutive_falses = 0
            
    print(f"Plant graphic horizontal boundary detected at x={gap_x}")
    
    # Crop the plant graphic from x=0 to x=gap_x
    plant = logo.crop((0, 0, gap_x, h))
    
    # Trim empty boundaries around the plant
    plant_bbox = plant.getbbox()
    if plant_bbox:
        plant = plant.crop(plant_bbox)
        
    # We want the favicon to be square. Let's make it a square image (e.g. 512x512) and center the plant inside it
    size = max(plant.width, plant.height) + 20
    square_plant = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    # Center the plant
    offset_x = (size - plant.width) // 2
    offset_y = (size - plant.height) // 2
    square_plant.paste(plant, (offset_x, offset_y))
    
    # Save as app/icon.png
    square_plant.save("app/icon.png", "PNG")
    print(f"Successfully processed app/icon.png: size={square_plant.size}")

if __name__ == "__main__":
    main()
